export type RiskZone = "safe" | "watch" | "critical";

export interface Subtask {
  id: string;
  title: string;
  estimatedMinutes: number;
  done: boolean;
  order: number;
  googleEventId?: string;
  syncError?: string;
}

export interface ReminderContext {
  nextLogicalStep: string;
  contextualAdvice: string;
  resourceSearchQueries: string[];
  draftTemplate: string;
  createdAt: string;
}

export interface CalendarSyncState {
  syncStatus: "not_synced" | "partial" | "synced" | "failed";
  syncedEvents: number;
  totalEvents: number;
  lastSyncAttempt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  complexity: "low" | "medium" | "high";
  totalEffortMinutes: number;
  riskScore: number;
  riskZone: RiskZone;
  deadline: string;
  subtasks: Subtask[];
  sessionsCompleted: number;
  sessionsPlanned: number;
  riskFactors: string[];
  createdAt: string;
  googleCalendarSynced: boolean;
  googleTasksSynced: boolean;
  calendarSync?: CalendarSyncState;
  recoveryPlan?: {
    isRecovered: boolean;
    situationSummary: string;
    messageToUser: string;
    advice: string;
  };
  reminderContext?: ReminderContext;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

export interface OCRExtractedCommitment {
  id: string;
  title: string;
  deadline: string;
  description: string;
  estimatedMinutes: number;
  confidence: number;
}
