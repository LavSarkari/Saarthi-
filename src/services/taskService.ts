import { Task, CommitmentType, CommitmentCategory, ReminderStage } from "../types.js";
import { AppError } from "./errorHandler.js";
import { computeRiskScore } from "../lib/riskEngine.js";

export interface TaskInput {
  userId: string;
  title: string;
  description?: string;
  complexity?: "low" | "medium" | "high";
  totalEffortMinutes?: number;
  deadline?: string;
  isHardDeadline?: boolean;
  subtasks?: {
    title: string;
    estimatedMinutes?: number;
    order?: number;
  }[];
  riskFactors?: string[];
  deduplicationKey?: string;
  commitmentType?: CommitmentType;
  category?: CommitmentCategory;
  amount?: number;
  renewalDate?: string;
}

export class TaskService {
  private deduplicationCache = new Set<string>();

  /**
   * Strictly validates incoming raw task creations and structures them into atomic, fully integrated Task structures.
   * Canonical Source of Truth: commitmentType is authoritative. isHardDeadline is strictly derived (commitmentType === "HARD").
   */
  validateAndPrepareTask(input: TaskInput): Task {
    if (!input.userId) {
      throw new AppError("A valid user ID is required to associate a task.", "BAD_REQUEST", 400);
    }
    if (!input.title || input.title.trim().length === 0) {
      throw new AppError("Task title is required.", "BAD_REQUEST", 400);
    }

    // 1. Resolve Canonical Source of Truth & Contradictory Input: commitmentType vs isHardDeadline
    let commitmentType: CommitmentType;
    if (input.commitmentType) {
      commitmentType = input.commitmentType;
    } else if (input.isHardDeadline !== undefined) {
      commitmentType = input.isHardDeadline ? "HARD" : "FLEXIBLE";
    } else if (input.category === "BILL" || input.category === "EXAM" || input.category === "INTERVIEW") {
      commitmentType = "HARD";
    } else {
      commitmentType = "FLEXIBLE";
    }

    // Strict Rule: A HARD commitment CANNOT be created without a valid, non-empty deadline
    if (commitmentType === "HARD" && (!input.deadline || input.deadline.trim().length === 0)) {
      throw new AppError("A HARD commitment requires an explicit target deadline.", "BAD_REQUEST", 400);
    }

    // Require valid deadline for flexible commitments as well unless default horizon applies
    const rawDeadline = input.deadline || new Date(Date.now() + 86400000).toISOString();
    const deadlineDate = new Date(rawDeadline);
    if (isNaN(deadlineDate.getTime())) {
      throw new AppError("Invalid deadline date format.", "BAD_REQUEST", 400);
    }

    if (typeof input.amount === "number" && input.amount < 0) {
      throw new AppError("Commitment amount must be a non-negative number.", "BAD_REQUEST", 400);
    }

    // Check for duplicate write retries using in-memory deduplication cache
    if (input.deduplicationKey) {
      const isDuplicate = this.deduplicationCache.has(input.deduplicationKey);
      if (isDuplicate) {
        throw new AppError("Duplicate task write transaction aborted.", "CONFLICT", 409, {
          deduplicationKey: input.deduplicationKey,
        });
      }
      this.deduplicationCache.add(input.deduplicationKey);
      if (this.deduplicationCache.size > 5000) {
        this.deduplicationCache.clear();
      }
    }

    // Synchronize isHardDeadline strictly from canonical commitmentType
    const isHardDeadline = commitmentType === "HARD";

    // Structure subtasks cleanly
    const validatedSubtasks = (input.subtasks || []).map((sub, index) => {
      const orderVal = typeof sub.order === "number" ? sub.order : index + 1;
      const minutesVal = typeof sub.estimatedMinutes === "number" && sub.estimatedMinutes > 0 
        ? sub.estimatedMinutes 
        : 45;

      const subTitle = sub.title && sub.title.trim().length > 0 ? sub.title.trim() : `Milestone Session ${orderVal}`;

      return {
        id: `sub_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        title: subTitle,
        estimatedMinutes: minutesVal,
        done: false,
        order: orderVal,
      };
    });

    if (validatedSubtasks.length === 0) {
      validatedSubtasks.push({
        id: `sub_${Date.now()}_0`,
        title: "Setup and initial analysis blocks",
        estimatedMinutes: 45,
        done: false,
        order: 1,
      });
    }

    const totalMinutes = validatedSubtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      id: taskId,
      userId: input.userId,
      title: input.title.trim(),
      description: (input.description || "").trim(),
      complexity: input.complexity || "medium",
      totalEffortMinutes: totalMinutes,
      riskScore: 0,
      riskZone: "safe",
      deadline: deadlineDate.toISOString(),
      subtasks: validatedSubtasks,
      sessionsPlanned: validatedSubtasks.length,
      sessionsCompleted: 0,
      riskFactors: input.riskFactors || [],
      createdAt: new Date().toISOString(),
      googleCalendarSynced: false,
      googleTasksSynced: false,
      commitmentType,
      isHardDeadline,
      category: input.category || (isHardDeadline ? "EXAM" : "PERSONAL_FLEXIBLE"),
      amount: input.amount,
      paymentStatus: input.category === "BILL" ? "UNPAID" : undefined,
      subscriptionStatus: input.category === "SUBSCRIPTION" ? "ACTIVE" : undefined,
      renewalDate: input.renewalDate || (input.category === "SUBSCRIPTION" ? deadlineDate.toISOString() : undefined),
    };
  }

  /**
   * Deterministic background worker for Bill Overdue Detection and Escalation Reminder Engine.
   */
  processBillAndSubscriptionMonitoring(tasks: Task[], now: Date = new Date()): { updatedTasks: Task[]; notifications: string[] } {
    const updatedTasks: Task[] = [];
    const notifications: string[] = [];

    for (const task of tasks) {
      let taskChanged = false;
      const t = { ...task };

      // 1. Bill Overdue Detection: Due date passed AND paymentStatus !== "PAID"
      if (t.category === "BILL" && t.paymentStatus === "UNPAID") {
        const deadlineMs = new Date(t.deadline).getTime();
        if (deadlineMs < now.getTime()) {
          t.paymentStatus = "OVERDUE";
          taskChanged = true;
          notifications.push(`🚨 CRITICAL BILL OVERDUE: '${t.title}' due on ${new Date(t.deadline).toLocaleDateString()} was NOT paid. Amount: $${t.amount || 0}.`);
        }
      }

      // 2. Deterministic Reminder Escalation Stage Calculation
      const deadlineMs = new Date(t.deadline).getTime();
      const diffMs = deadlineMs - now.getTime();
      let newStage: ReminderStage | undefined;

      if (diffMs <= 0) {
        newStage = "OVERDUE";
      } else if (diffMs <= 86400000) {
        newStage = "DUE_DATE";
      } else if (diffMs <= 86400000 * 1) {
        newStage = "1_DAY";
      } else if (diffMs <= 86400000 * 3) {
        newStage = "3_DAYS";
      } else if (diffMs <= 86400000 * 7) {
        newStage = "7_DAYS";
      }

      // Idempotency Protection: Send notification ONLY when reminderStage transitions to a new stage
      if (newStage && newStage !== t.reminderStage && !t.isCompleted && t.paymentStatus !== "PAID") {
        t.reminderStage = newStage;
        taskChanged = true;
        notifications.push(`⏰ COMMITMENT ALERT [${newStage}]: '${t.title}' (${t.commitmentType || "FLEXIBLE"}) is due on ${new Date(t.deadline).toLocaleString()}.`);
      }

      // Recompute risk score & zone
      const newRisk = computeRiskScore(t);
      if (newRisk.score !== t.riskScore || newRisk.zone !== t.riskZone) {
        t.riskScore = newRisk.score;
        t.riskZone = newRisk.zone;
        taskChanged = true;
      }

      if (taskChanged) {
        updatedTasks.push(t);
      }
    }

    return { updatedTasks, notifications };
  }

  /**
   * Deterministic Subscription Renewal Recurrence Engine.
   * Generates next period's renewal instance idempotently with stable IDs.
   */
  generateSubscriptionRenewals(tasks: Task[], now: Date = new Date()): { updatedTasks: Task[]; newRenewalTasks: Task[] } {
    const updatedTasks: Task[] = [];
    const newRenewalTasks: Task[] = [];

    const subscriptionTasks = tasks.filter((t) => t.category === "SUBSCRIPTION" && t.subscriptionStatus === "ACTIVE");

    for (const sub of subscriptionTasks) {
      const renewalMs = sub.renewalDate ? new Date(sub.renewalDate).getTime() : new Date(sub.deadline).getTime();

      // If renewal date is within 7 days or has passed, check if next cycle instance already exists
      if (renewalMs - now.getTime() <= 7 * 86400000) {
        const nextRenewalDate = new Date(renewalMs + 30 * 86400000);
        const dateKey = nextRenewalDate.toISOString().substring(0, 10);
        const stableId = `sub_renewal_${sub.id}_${dateKey}`;

        // Check if instance already exists (Idempotency Invariant)
        const exists = tasks.some((t) => t.id === stableId) || newRenewalTasks.some((t) => t.id === stableId);

        if (!exists) {
          const newRenewalTask: Task = {
            ...sub,
            id: stableId,
            title: `${sub.title} (Renewal - ${dateKey})`,
            deadline: nextRenewalDate.toISOString(),
            renewalDate: nextRenewalDate.toISOString(),
            createdAt: now.toISOString(),
            isCompleted: false,
            sessionsCompleted: 0,
            subtasks: sub.subtasks.map((st, i) => ({
              ...st,
              id: `sub_${stableId}_${i + 1}`,
              done: false,
              scheduledStart: undefined,
              scheduledEnd: undefined,
              googleEventId: undefined,
            })),
          };
          newRenewalTasks.push(newRenewalTask);
        }
      }
    }

    return { updatedTasks, newRenewalTasks };
  }

  /**
   * Verifies subtask integrity and status changes to maintain parity.
   */
  syncSessionsCount(subtasks: { done: boolean }[]): { planned: number; completed: number } {
    return {
      planned: subtasks.length,
      completed: subtasks.filter((s) => s.done).length,
    };
  }
}

export const taskService = new TaskService();
