import { Task, NotificationStage, CommitmentType } from "../types.js";
import { computeRiskScore } from "../lib/riskEngine.js";
import { telegramService } from "./telegramService.js";

export interface NotificationRecord {
  notificationId: string;
  taskId: string;
  stage: NotificationStage;
  priority: number; // 1 (Highest) to 10 (Lowest)
  message: string;
  timestamp: string;
  delivered: boolean;
}

export class NotificationService {
  /**
   * Deterministic Notification Stage & Urgency Ranker.
   * Priority:
   * 1. OVERDUE HARD
   * 2. CRITICAL HARD
   * 3. MISSED
   * 4. HARD DUE
   * 5. BLOCKED HARD
   * 6. RESCHEDULED HARD
   * 7. OVERDUE FLEXIBLE
   * 8. URGENT
   * 9. APPROACHING
   * 10. UPCOMING
   */
  public getNotificationPriority(stage: NotificationStage, isHard: boolean): number {
    if (stage === "OVERDUE" && isHard) return 1;
    if (stage === "CRITICAL" && isHard) return 2;
    if (stage === "MISSED") return 3;
    if (stage === "DUE" && isHard) return 4;
    if (stage === "BLOCKED" && isHard) return 5;
    if (stage === "RESCHEDULED" && isHard) return 6;
    if (stage === "OVERDUE" && !isHard) return 7;
    if (stage === "URGENT") return 8;
    if (stage === "APPROACHING") return 9;
    return 10; // UPCOMING or fallback
  }

  /**
   * Evaluates a single task's state deterministically and returns a NotificationRecord if a stage transition occurs.
   * Idempotency Invariant: Once a notification key (taskId:stage:deadline) is delivered, it is NEVER re-fired.
   */
  public evaluateTaskNotification(
    task: Task,
    now: Date = new Date(),
    overrideEvent?: { stage: NotificationStage; message?: string }
  ): { record: NotificationRecord | null; updatedTask: Task } {
    // Paid bills or completed tasks stop standard deadline escalation (unless explicit RECOVERED)
    if ((task.isCompleted || task.paymentStatus === "PAID") && overrideEvent?.stage !== "RECOVERED") {
      return { record: null, updatedTask: task };
    }
    if (task.subscriptionStatus === "CANCELLED") {
      return { record: null, updatedTask: task };
    }

    const isHard = task.commitmentType === "HARD" || task.isHardDeadline === true;
    const deadlineMs = new Date(task.deadline).getTime();
    const diffMs = deadlineMs - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    let stage: NotificationStage = "UPCOMING";
    let messageText = "";

    if (overrideEvent) {
      stage = overrideEvent.stage;
      messageText = overrideEvent.message || `Notification: ${stage} for '${task.title}'`;
    } else {
      const risk = computeRiskScore(task);

      if (task.paymentStatus === "OVERDUE" || diffMs <= 0) {
        stage = "OVERDUE";
        messageText = `🚨 OVERDUE ALERT: '${task.title}' (${isHard ? "HARD COMMITMENT" : "FLEXIBLE"}) passed deadline on ${new Date(task.deadline).toLocaleString()}. Risk score: ${risk.score}.`;
      } else if (diffHours <= 3 || risk.zone === "critical") {
        stage = "CRITICAL";
        messageText = `🔥 CRITICAL DEADLINE ALERT: '${task.title}' (${isHard ? "HARD COMMITMENT" : "FLEXIBLE"}) is due in ${Math.max(0, Math.round(diffHours * 10) / 10)}h. Immediate action required.`;
      } else if (diffHours <= 12) {
        stage = "URGENT";
        messageText = `⚠️ URGENT COMMITMENT: '${task.title}' is due in ${Math.round(diffHours)}h on ${new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      } else if (diffHours <= 24) {
        stage = "DUE";
        messageText = `⏰ DUE TODAY: '${task.title}' is scheduled for completion today (${new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`;
      } else if (diffHours <= 72) {
        stage = "APPROACHING";
        messageText = `📌 APPROACHING DEADLINE: '${task.title}' is due in ${Math.round(diffHours / 24)} days on ${new Date(task.deadline).toLocaleDateString()}.`;
      } else {
        stage = "UPCOMING";
        messageText = `🗓 UPCOMING COMMITMENT: '${task.title}' is planned for ${new Date(task.deadline).toLocaleDateString()}.`;
      }
    }

    const versionKey = `${task.id}:${stage}:${task.deadline}`;
    const deliveredKeys = new Set(task.deliveredNotificationKeys || []);

    // Idempotency check: If this exact version key was already delivered, skip!
    if (deliveredKeys.has(versionKey)) {
      return { record: null, updatedTask: task };
    }

    // Monotonic Stage Escalation Rule: Skip lower or equal priority if already delivered unless explicit event
    if (!overrideEvent && task.lastNotificationStage) {
      const currentPriority = this.getNotificationPriority(stage, isHard);
      const lastPriority = this.getNotificationPriority(task.lastNotificationStage, isHard);
      if (currentPriority >= lastPriority && stage !== "OVERDUE") {
        return { record: null, updatedTask: task };
      }
    }

    const priority = this.getNotificationPriority(stage, isHard);
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const record: NotificationRecord = {
      notificationId,
      taskId: task.id,
      stage,
      priority,
      message: messageText,
      timestamp: now.toISOString(),
      delivered: false,
    };

    deliveredKeys.add(versionKey);

    const updatedTask: Task = {
      ...task,
      lastNotificationStage: stage,
      deliveredNotificationKeys: Array.from(deliveredKeys),
    };

    return { record, updatedTask };
  }

  /**
   * Batch evaluates tasks, ranks notifications by priority, and dispatches them safely.
   */
  public async evaluateAndDispatchNotifications(
    tasks: Task[],
    options: {
      now?: Date | string;
      telegramChatId?: string | number;
      overrideEvents?: { taskId: string; stage: NotificationStage; message?: string }[];
    } = {}
  ): Promise<{ updatedTasks: Task[]; deliveredRecords: NotificationRecord[]; batchSummaryMessage: string | null }> {
    const now = typeof options.now === "string" ? new Date(options.now) : options.now || new Date();
    const updatedTasks: Task[] = [...tasks];
    const newRecords: NotificationRecord[] = [];

    // Map overrides for quick lookup
    const overrideMap = new Map<string, { stage: NotificationStage; message?: string }>();
    if (options.overrideEvents) {
      for (const ev of options.overrideEvents) {
        overrideMap.set(ev.taskId, { stage: ev.stage, message: ev.message });
      }
    }

    for (let i = 0; i < updatedTasks.length; i++) {
      const task = updatedTasks[i];
      const overrideEv = overrideMap.get(task.id);
      const { record, updatedTask } = this.evaluateTaskNotification(task, now, overrideEv);
      updatedTasks[i] = updatedTask;

      if (record) {
        newRecords.push(record);
      }
    }

    if (newRecords.length === 0) {
      return { updatedTasks, deliveredRecords: [], batchSummaryMessage: null };
    }

    // Sort notifications by Priority (1 = Highest)
    newRecords.sort((a, b) => a.priority - b.priority);

    // Notification Batching: If multiple non-critical notifications occur simultaneously, batch them!
    const criticalRecords = newRecords.filter((r) => r.priority <= 3);
    const standardRecords = newRecords.filter((r) => r.priority > 3);

    const messagesToSend: string[] = [];

    // Critical alerts sent immediately individually for visibility
    for (const cRec of criticalRecords) {
      messagesToSend.push(cRec.message);
      cRec.delivered = true;
    }

    // Standard alerts batched if there are 2 or more
    if (standardRecords.length >= 2) {
      const batchHeader = `📋 SAARTHI COMMITMENT BRIEFING (${standardRecords.length} updates):\n`;
      const batchBody = standardRecords.map((r, idx) => `${idx + 1}. ${r.message}`).join("\n\n");
      messagesToSend.push(`${batchHeader}\n${batchBody}`);
      for (const sRec of standardRecords) {
        sRec.delivered = true;
      }
    } else if (standardRecords.length === 1) {
      messagesToSend.push(standardRecords[0].message);
      standardRecords[0].delivered = true;
    }

    // Dispatch to Telegram safely (Channel Independence & Error Fault Tolerance)
    if (options.telegramChatId) {
      const chatIdNum = typeof options.telegramChatId === "string" ? parseInt(options.telegramChatId, 10) : options.telegramChatId;
      if (!isNaN(chatIdNum)) {
        for (const msgText of messagesToSend) {
          try {
            await telegramService.sendMessage(chatIdNum, msgText);
          } catch (teleErr) {
            console.warn("Telegram dispatch soft failure (scheduling continues unaffected):", teleErr);
          }
        }
      }
    }

    const batchSummaryMessage = messagesToSend.join("\n---\n");

    return {
      updatedTasks,
      deliveredRecords: newRecords,
      batchSummaryMessage,
    };
  }
}

export const notificationService = new NotificationService();
