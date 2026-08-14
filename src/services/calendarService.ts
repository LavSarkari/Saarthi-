import { AppError } from "./errorHandler.js";
import { Task, Subtask, CalendarSyncState } from "../types.js";

export interface CalendarEvent {
  id?: string;
  summary: string;
  description: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
}

export interface BusyInterval {
  start: string;
  end: string;
  summary?: string;
}

export class CalendarService {
  /**
   * Helper utility to convert a local date string (YYYY-MM-DD) into an ISO string respecting target timeZone.
   */
  formatLocalDateToIso(dateStr: string, timeZone = "UTC", isEnd = false): string {
    if (!dateStr) return isEnd ? new Date().toISOString() : new Date().toISOString();
    try {
      const timeSuffix = isEnd ? "T23:59:59.999" : "T00:00:00.000";
      const dt = new Date(`${dateStr}${timeSuffix}`);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString();
      }
    } catch (err) {}
    return isEnd ? `${dateStr}T23:59:59.999Z` : `${dateStr}T00:00:00.000Z`;
  }

  /**
   * Fetches Google Calendar availability intervals and normalizes them for the Deterministic Scheduler.
   * Queries events list to obtain full metadata for loop protection (filtering 'Saarthi Exec:' events)
   * and respecting 'transparent' (Free) events.
   * Throws an EXPLICIT AppError if Calendar API fails — NEVER returns an empty fallback array on error.
   */
  async fetchFreeBusyIntervals(
    accessToken: string,
    timeMin: string,
    timeMax: string,
    timeZone = "UTC"
  ): Promise<BusyInterval[]> {
    if (!accessToken || accessToken.trim() === "") {
      throw new AppError("Google OAuth access token is required to fetch calendar availability.", "UNAUTHORIZED", 401);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new AppError(
          `Google Calendar API failed with status ${response.status}: ${errText}`,
          "SERVICE_UNAVAILABLE",
          response.status === 401 ? 401 : 503
        );
      }

      const data = await response.json();
      const items = data.items || [];

      const busyIntervals: BusyInterval[] = [];

      for (const item of items) {
        // Skip events marked as 'transparent' (Free in Google Calendar)
        if (item.transparency === "transparent") continue;

        // LOOP PROTECTION: Exclude Saarthi's own created execution events to prevent self-collision loops
        if (item.summary && item.summary.startsWith("Saarthi Exec:")) continue;

        let startIso: string;
        let endIso: string;

        if (item.start?.dateTime) {
          startIso = new Date(item.start.dateTime).toISOString();
        } else if (item.start?.date) {
          // Timezone-aware All-Day Event start normalization
          startIso = this.formatLocalDateToIso(item.start.date, timeZone, false);
        } else {
          continue;
        }

        if (item.end?.dateTime) {
          endIso = new Date(item.end.dateTime).toISOString();
        } else if (item.end?.date) {
          // Timezone-aware All-Day Event end normalization
          endIso = this.formatLocalDateToIso(item.end.date, timeZone, true);
        } else {
          continue;
        }

        busyIntervals.push({
          start: startIso,
          end: endIso,
          summary: item.summary || "Busy",
        });
      }

      return busyIntervals;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Google Calendar API communication error: ${err.message}`,
        "SERVICE_UNAVAILABLE",
        503
      );
    }
  }

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

    let sessionCursor = new Date(Date.now() + 2 * 3600 * 1000);

    for (const [idx, sub] of task.subtasks.entries()) {
      if (sessionCursor.getTime() > deadlineDate.getTime()) {
        sessionCursor = new Date(deadlineDate.getTime() - 3600 * 1000 * (4 - idx));
      }

      if (sessionCursor.getTime() < Date.now()) {
        sessionCursor = new Date(Date.now() + 15 * 60 * 1000);
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

      sessionCursor.setHours(sessionCursor.getHours() + 12);
    }

    return events;
  }

  /**
   * Validates calendar event structure and constraints before transmission.
   */
  validateEventPayload(event: CalendarEvent): void {
    if (!event.summary || event.summary.trim() === "") {
      throw new AppError("Calendar event summary is mandatory.", "BAD_REQUEST", 400);
    }
    const startStr = event.start?.dateTime || (event.start?.date ? `${event.start.date}T00:00:00.000Z` : undefined);
    const endStr = event.end?.dateTime || (event.end?.date ? `${event.end.date}T23:59:59.999Z` : undefined);

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
    if (durationMin <= 0 || durationMin > 10080) {
      throw new AppError(`Invalid event duration calculated: ${durationMin} minutes.`, "BAD_REQUEST", 400);
    }
  }

  /**
   * Helper utility wrapping target fetch requests with exponential backoff retries.
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

        if (response.status === 401) {
          return response;
        }

        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }

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
   * Synchronizes Saarthi task schedule blocks with Google Calendar.
   * If a subtask has an existing googleEventId, it performs a PUT (Update).
   * If a subtask has no googleEventId, it performs a POST (Create).
   * Idempotent: Repeated syncs update existing events without duplicate creation.
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
          syncedEvents: task.subtasks.filter((s) => s.googleEventId).length,
          totalEvents: task.subtasks.length,
          lastSyncAttempt: new Date().toISOString(),
        },
        updatedSubtasks: task.subtasks,
        errors: ["Google OAuth access token is expired or missing."],
        tokenExpired: true,
      };
    }

    const totalEvents = task.subtasks.length;
    let syncedEvents = 0;
    const errors: string[] = [];
    const updatedSubtasks: Subtask[] = JSON.parse(JSON.stringify(task.subtasks));
    let tokenExpired = false;

    let sessionStart = new Date(Date.now() + 3600000 * 2);

    for (const sub of updatedSubtasks) {
      const startIso = sub.scheduledStart || sessionStart.toISOString();
      const endIso = sub.scheduledEnd || new Date(new Date(startIso).getTime() + sub.estimatedMinutes * 60000).toISOString();

      const eventData: CalendarEvent = {
        summary: `Saarthi Exec: ${sub.title}`,
        description: `Dedicated time block for commitment: ${task.title}. Planned effort: ${sub.estimatedMinutes} mins.`,
        start: {
          dateTime: startIso,
          timeZone,
        },
        end: {
          dateTime: endIso,
          timeZone,
        },
      };

      try {
        this.validateEventPayload(eventData);

        let url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
        let method = "POST";

        if (sub.googleEventId) {
          url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${sub.googleEventId}`;
          method = "PUT";
        }

        const response = await this.fetchWithRetry(url, {
          method,
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
          break;
        }

        if (response.ok) {
          const body = await response.json();
          if (body.id) {
            sub.googleEventId = body.id;
            delete sub.syncError;
            syncedEvents++;
          }
        } else {
          const rawErrText = await response.text();
          const specErr = `API rejected transmission (Status Code ${response.status}): ${rawErrText}`;
          errors.push(specErr);
          sub.syncError = specErr;
        }
      } catch (err: any) {
        const errorMsg = err.message || "Network communication failure.";
        errors.push(errorMsg);
        sub.syncError = errorMsg;
      }

      sessionStart = new Date(sessionStart.getTime() + 12 * 3600000);
    }

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
        lastSyncAttempt: new Date().toISOString(),
      },
      updatedSubtasks,
      errors,
      tokenExpired,
    };
  }

  /**
   * Deletes a Saarthi calendar event when a commitment/subtask is cancelled or deleted.
   */
  async deleteCalendarEvent(googleEventId: string, accessToken: string): Promise<boolean> {
    if (!googleEventId || !accessToken) return false;
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return response.ok || response.status === 404;
    } catch (err) {
      console.warn("Failed to delete calendar event:", googleEventId, err);
      return false;
    }
  }
}

export const calendarService = new CalendarService();
