import { Task, CommitmentType, CommitmentCategory } from "../../types.js";

export interface TaskFactoryOptions {
  id?: string;
  userId?: string;
  title?: string;
  durationMinutes?: number;
  deadlineOffsetHours?: number;
  isCompleted?: boolean;
  isLate?: boolean;
  dependsOn?: string[];
  commitmentType?: CommitmentType;
  category?: CommitmentCategory;
  amount?: number;
  paymentStatus?: "UNPAID" | "PAID" | "OVERDUE";
  subscriptionStatus?: "ACTIVE" | "CANCELLED" | "EXPIRED";
  renewalDate?: string;
  googleEventId?: string;
  createdAt?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export function createTaskFixture(options: TaskFactoryOptions = {}): Task {
  const id = options.id || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const userId = options.userId || "user_phase8";
  const title = options.title || `Test Task ${id}`;
  const durationMinutes = options.durationMinutes || 60;
  const deadlineOffsetHours = options.deadlineOffsetHours !== undefined ? options.deadlineOffsetHours : 24;
  const isCompleted = options.isCompleted || false;
  const commitmentType = options.commitmentType || "HARD";
  const category = options.category || "EXAM";

  const createdMs = options.createdAt ? new Date(options.createdAt).getTime() : new Date("2026-08-15T09:00:00.000Z").getTime();
  const deadlineMs = createdMs + deadlineOffsetHours * 3600000;
  const deadlineIso = new Date(deadlineMs).toISOString();

  return {
    id,
    userId,
    title,
    description: `Fixture for ${title}`,
    complexity: "medium",
    priority: "medium",
    totalEffortMinutes: durationMinutes,
    riskScore: 0,
    riskZone: "safe",
    deadline: deadlineIso,
    subtasks: [
      {
        id: `sub_${id}_1`,
        title: `${title} Subtask 1`,
        estimatedMinutes: durationMinutes,
        done: isCompleted,
        order: 1,
        scheduledStart: options.scheduledStart,
        scheduledEnd: options.scheduledEnd,
        googleEventId: options.googleEventId,
      },
    ],
    sessionsCompleted: isCompleted ? 1 : 0,
    sessionsPlanned: 1,
    riskFactors: [],
    createdAt: new Date(createdMs).toISOString(),
    googleCalendarSynced: !!options.googleEventId,
    googleTasksSynced: false,
    dependsOn: options.dependsOn || [],
    commitmentType,
    isHardDeadline: commitmentType === "HARD",
    category,
    amount: options.amount,
    paymentStatus: options.paymentStatus,
    subscriptionStatus: options.subscriptionStatus,
    renewalDate: options.renewalDate,
    isCompleted,
    deliveredNotificationKeys: [],
  };
}
