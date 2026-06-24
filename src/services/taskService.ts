import { AppError } from "./errorHandler.js";

export interface TaskInput {
  userId: string;
  title: string;
  description?: string;
  complexity?: "low" | "medium" | "high";
  totalEffortMinutes?: number;
  deadline: string;
  subtasks: {
    title: string;
    estimatedMinutes?: number;
    order?: number;
  }[];
  riskFactors?: string[];
  deduplicationKey?: string; // Ensures idempotent writes
}

export class TaskService {
  private deduplicationCache = new Set<string>();

  /**
   * Strictly validates incoming raw task creations and structures them into atomic, fully integrated Task structures.
   */
  validateAndPrepareTask(input: TaskInput) {
    if (!input.userId) {
      throw new AppError("A valid user ID is required to associate a task.", "BAD_REQUEST", 400);
    }
    if (!input.title || input.title.trim().length === 0) {
      throw new AppError("Task title is required.", "BAD_REQUEST", 400);
    }
    if (!input.deadline) {
      throw new AppError("Task target deadline is required.", "BAD_REQUEST", 400);
    }

    const deadlineDate = new Date(input.deadline);
    if (isNaN(deadlineDate.getTime())) {
      throw new AppError("Invalid deadline date format.", "BAD_REQUEST", 400);
    }

    // Check for duplicate write retries using basic in-memory deduplication cache
    if (input.deduplicationKey) {
      const isDuplicate = this.deduplicationCache.has(input.deduplicationKey);
      if (isDuplicate) {
        throw new AppError("Duplicate task write transaction aborted.", "CONFLICT", 409, {
          deduplicationKey: input.deduplicationKey,
        });
      }
      this.deduplicationCache.add(input.deduplicationKey);
      // Prune old entries occasionally to prevent leak
      if (this.deduplicationCache.size > 5000) {
        this.deduplicationCache.clear();
      }
    }

    // Ensure task and subtasks remain perfectly structured and synchronized
    const validatedSubtasks = (input.subtasks || []).map((sub, index) => {
      const orderVal = typeof sub.order === "number" ? sub.order : index + 1;
      const minutesVal = typeof sub.estimatedMinutes === "number" && sub.estimatedMinutes > 0 
        ? sub.estimatedMinutes 
        : 45;

      if (!sub.title || sub.title.trim().length === 0) {
        sub.title = `Milestone Session ${orderVal}`;
      }

      return {
        id: `sub_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        title: sub.title.trim(),
        estimatedMinutes: minutesVal,
        done: false,
        order: orderVal,
      };
    });

    if (validatedSubtasks.length === 0) {
      // Create at least one baseline start subtask
      validatedSubtasks.push({
        id: `sub_${Date.now()}_0`,
        title: "Setup and initial analysis blocks",
        estimatedMinutes: 45,
        done: false,
        order: 1,
      });
    }

    // Ensure totalEffortMinutes is synchronized
    const totalMinutes = validatedSubtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);

    return {
      userId: input.userId,
      title: input.title.trim(),
      description: (input.description || "").trim(),
      complexity: input.complexity || "medium",
      totalEffortMinutes: totalMinutes,
      deadline: deadlineDate.toISOString(),
      subtasks: validatedSubtasks,
      sessionsPlanned: validatedSubtasks.length,
      sessionsCompleted: 0,
      riskFactors: input.riskFactors || [],
      createdAt: new Date().toISOString(),
      googleCalendarSynced: false,
      googleTasksSynced: false,
    };
  }

  /**
   * Verifies subtask integrity and status changes to maintain parity.
   */
  syncSessionsCount(subtasks: { done: boolean }[]): { planned: number; completed: number } {
    return {
      planned: subtasks.length,
      completed: subtasks.filter(s => s.done).length,
    };
  }
}

export const taskService = new TaskService();
