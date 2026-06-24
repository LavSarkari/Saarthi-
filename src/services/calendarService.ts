import { AppError } from "./errorHandler.js";
import { Task, Subtask, CalendarSyncState } from "../types.js";

export interface CalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

export class CalendarService {
  /**
   * Plans and reverse-engineers clear execution intervals for subtasks before the target deadline.
   */
  planExecutionIntervals(task: {
    title: string;
    deadline: string;
    subtasks: { title: string; estimatedMinutes: number }[];
  }, timeZone = "UTC"): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const deadlineDate = new Date(task.deadline);
    if (isNaN(deadlineDate.getTime())) {
      throw new AppError("Invalid deadline format. Cannot calculate calendar intervals.", "BAD_REQUEST", 400);
    }

    // Start booking 2 hours from now
    let sessionCursor = new Date(Date.now() + 2 * 3600 * 1000);

    for (const [idx, sub] of task.subtasks.entries()) {
      // If our sequential timeline exceeds the deadline, pull it backward to fit
      if (sessionCursor.getTime() > deadlineDate.getTime()) {
        sessionCursor = new Date(deadlineDate.getTime() - 3600 * 1000 * (4 - idx));
      }

      // Safeguard against cursors slipping behind current time
      if (sessionCursor.getTime() < Date.now()) {
        sessionCursor = new Date(Date.now() + 15 * 60 * 1000); // 15 mins from now minimum
      }

      const durationMs = (sub.estimatedMinutes || 45) * 60 * 1000;
      const sessionEnd = new Date(sessionCursor.getTime() + durationMs);

      events.push({
        summary: `Saarthi Exec: ${sub.title}`,
        description: `Dedicated time block for: ${task.title}. Total planned effort: ${sub.estimatedMinutes} mins.`,
        start: {
          dateTime: sessionCursor.toISOString(),
          timeZone,
        },
        end: {
          dateTime: sessionEnd.toISOString(),
          timeZone,
        },
      });

      // Spread next subtask by 12 hours
      sessionCursor.setHours(sessionCursor.getHours() + 12);
    }

    return events;
  }

  /**
   * Validates calendar event structure and constraints before transmission to protect against API failure.
   */
  validateEventPayload(event: CalendarEvent): void {
    if (!event.summary || event.summary.trim() === "") {
      throw new AppError("Calendar event summary is mandatory.", "BAD_REQUEST", 400);
    }
    const startStr = event.start?.dateTime;
    const endStr = event.end?.dateTime;
    if (!startStr || !endStr) {
      throw new AppError("Calendar event requires start and end dateTimes.", "BAD_REQUEST", 400);
    }
    const startNum = new Date(startStr).getTime();
    const endNum = new Date(endStr).getTime();
    if (isNaN(startNum)) {
      throw new AppError(`Invalid start dateTime formatting: ${startStr}`, "BAD_REQUEST", 400);
    }
    if (isNaN(endNum)) {
      throw new AppError(`Invalid end dateTime formatting: ${endStr}`, "BAD_REQUEST", 400);
    }
    if (endNum <= startNum) {
      throw new AppError(`End time (${endStr}) must be chronologically after start time (${startStr}).`, "BAD_REQUEST", 400);
    }
    const durationMin = (endNum - startNum) / (1000 * 60);
    if (durationMin <= 0 || durationMin > 10080) { // 7 days max
      throw new AppError(`Invalid event duration calculated: ${durationMin} minutes.`, "BAD_REQUEST", 400);
    }
  }

  /**
   * Helper utility wrapping target fetch requests with intelligent transient failure retry constraints.
   */
  async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<Response> {
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        // 401 Unauthorized signals token expiration immediately - do not retry
        if (response.status === 401) {
          return response;
        }

        // Standard client errors (e.g. 400) represent bad parameters - do not retry
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }

        // 429 (rate-limiting) and 5xx (internal server faults) are transient and eligible for retry
        if (response.ok) {
          return response;
        }

        lastError = new Error(`Google API returned status key: ${response.status}`);
      } catch (err: any) {
        lastError = err;
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`Transient calendar API error. Retry attempt ${attempt}/${maxRetries} starting in ${delay}ms...`, lastError);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError || new Error("Operation failed after max retries.");
  }

  /**
   * Robust multi-session calendar synchronization engine.
   * Leverages cached event IDs to bypass duplicate insertions and enables resume-on-failure recovery support.
   */
  async syncTaskCalendarEvents(
    task: Task,
    accessToken: string,
    timeZone = "UTC"
  ): Promise<{
    syncState: CalendarSyncState;
    updatedSubtasks: Subtask[];
    errors: string[];
    tokenExpired?: boolean;
  }> {
    if (!accessToken || accessToken.trim().length === 0) {
      return {
        syncState: {
          syncStatus: "failed",
          syncedEvents: task.subtasks.filter(s => s.googleEventId).length,
          totalEvents: task.subtasks.length,
          lastSyncAttempt: new Date().toISOString()
        },
        updatedSubtasks: task.subtasks,
        errors: ["Google OAuth access token is expired or missing."],
        tokenExpired: true
      };
    }

    const totalEvents = task.subtasks.length;
    let syncedEvents = 0;
    const errors: string[] = [];
    const updatedSubtasks: Subtask[] = JSON.parse(JSON.stringify(task.subtasks));
    let tokenExpired = false;

    const deadlineDate = new Date(task.deadline);
    if (isNaN(deadlineDate.getTime())) {
      return {
        syncState: {
          syncStatus: "failed",
          syncedEvents: 0,
          totalEvents,
          lastSyncAttempt: new Date().toISOString()
        },
        updatedSubtasks,
        errors: ["Failed to calculate timeline ranges as task deadline was corrupted."]
      };
    }

    let sessionStart = new Date(Date.now() + 3600000 * 2);

    for (const [idx, sub] of updatedSubtasks.entries()) {
      if (sessionStart.getTime() > deadlineDate.getTime()) {
        sessionStart = new Date(deadlineDate.getTime() - 360000 * (4 - idx));
      }
      if (sessionStart.getTime() < Date.now()) {
        sessionStart = new Date(Date.now() + 15 * 60 * 1000);
      }
      const sessionEnd = new Date(sessionStart.getTime() + sub.estimatedMinutes * 60000);

      // DUPLICATE EVENT PROTECTION: Skip subtasks that have already synced successfully
      if (sub.googleEventId) {
        syncedEvents++;
        sessionStart.setHours(sessionStart.getHours() + 12);
        continue;
      }

      const eventData: CalendarEvent = {
        summary: `Saarthi Exec: ${sub.title}`,
        description: `Dedicated time block for your commitment: ${task.title}. Total planned effort: ${sub.estimatedMinutes} mins.`,
        start: {
          dateTime: sessionStart.toISOString(),
          timeZone,
        },
        end: {
          dateTime: sessionEnd.toISOString(),
          timeZone,
        },
      };

      try {
        // payload validation assertion
        this.validateEventPayload(eventData);

        const response = await this.fetchWithRetry("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData),
        });

        if (response.status === 401) {
          tokenExpired = true;
          const expiredErr = "Integration session has expired. Re-authenticate to resume syncing.";
          errors.push(expiredErr);
          sub.syncError = expiredErr;
          break; // Stop syncing remaining to avoid cascade noise
        }

        if (response.ok) {
          const body = await response.json();
          if (body.id) {
            sub.googleEventId = body.id;
            delete sub.syncError;
            syncedEvents++;
          } else {
            const emptyIdErr = "Successfully transmitted payload but returned event ID was empty.";
            errors.push(emptyIdErr);
            sub.syncError = emptyIdErr;
          }
        } else {
          const rawErrText = await response.text();
          const specErr = `API rejected transmission (Status Code ${response.status}): ${rawErrText}`;
          errors.push(specErr);
          sub.syncError = specErr;
        }

      } catch (err: any) {
        const errorMsg = err.message || "Network socket communication failure occurred.";
        errors.push(errorMsg);
        sub.syncError = errorMsg;
      }

      sessionStart.setHours(sessionStart.getHours() + 12);
    }

    // Determine current Sync Status
    let syncStatus: "not_synced" | "partial" | "synced" | "failed" = "not_synced";
    if (syncedEvents === totalEvents) {
      syncStatus = "synced";
    } else if (syncedEvents > 0) {
      syncStatus = "partial";
    } else if (errors.length > 0) {
      syncStatus = "failed";
    }

    return {
      syncState: {
        syncStatus,
        syncedEvents,
        totalEvents,
        lastSyncAttempt: new Date().toISOString()
      },
      updatedSubtasks,
      errors,
      tokenExpired
    };
  }
}

export const calendarService = new CalendarService();
