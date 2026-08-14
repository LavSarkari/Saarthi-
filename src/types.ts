export type RiskZone = "safe" | "watch" | "critical";

export type PlanningStrategy = "balanced" | "deep_work" | "deadline_first" | "energy_optimized" | "recovery_optimized" | "sprint_mode" | "minimal_survival";

export interface Subtask {
  id: string;
  title: string;
  estimatedMinutes: number;
  done: boolean;
  order: number;
  googleEventId?: string;
  syncError?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  adaptiveExplanation?: string;
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
  priority?: "low" | "medium" | "high";
  totalEffortMinutes: number;
  effortEstimateMinutes?: number;
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
  labels?: string[];
  notes?: string;
  context?: string;
  lastUpdated?: number;
  // Used by Activation Engine to mark tasks as "stuck"
  isStuck?: boolean;
  isCompleted?: boolean;
  orderIndex?: number;
  // Phase 1 Dependency Engine: Array of Task IDs that MUST be completed before this task can start
  dependsOn?: string[];
  // Phase 2/3 Deterministic Scheduler: Flag for non-negotiable hard deadlines
  isHardDeadline?: boolean;
  // Phase 5 Commitment Semantics & Bill/Subscription Types
  commitmentType?: CommitmentType;
  category?: CommitmentCategory;
  amount?: number;
  paymentStatus?: PaymentStatus;
  subscriptionStatus?: SubscriptionStatus;
  renewalDate?: string;
  reminderStage?: ReminderStage;
  // Phase 6 Notification Escalation & Idempotency Tracking
  lastNotificationStage?: NotificationStage;
  deliveredNotificationKeys?: string[];
}

export type CommitmentType = "HARD" | "FLEXIBLE";
export type CommitmentCategory = "EXAM" | "INTERVIEW" | "BILL" | "SUBSCRIPTION" | "MILESTONE" | "PERSONAL_FLEXIBLE" | "STUDY";
export type PaymentStatus = "UNPAID" | "PAID" | "OVERDUE";
export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED";
export type ReminderStage = "7_DAYS" | "3_DAYS" | "1_DAY" | "DUE_DATE" | "OVERDUE";
export type NotificationStage = "UPCOMING" | "APPROACHING" | "URGENT" | "CRITICAL" | "DUE" | "OVERDUE" | "BLOCKED" | "MISSED" | "RESCHEDULED" | "RECOVERED";

export type DependencyStatus = "READY" | "BLOCKED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";

export type RecoveryMode = "minimal" | "balanced" | "maximum" | "wellness";

export interface SuggestedTradeoff {
  taskId: string;
  originalTitle: string;
  proposedAction: "reduce_scope" | "delay" | "split" | "skip" | "compress";
  explanation: string;
  newDeadline?: string;
  newTitle?: string;
  effortSavedMinutes: number;
}

export interface RebuiltTask {
  taskId: string;
  title: string;
  newDeadline: string;
  priority: "low" | "medium" | "high";
  action: "keep" | "move" | "modify";
  notes?: string;
}

export interface AIRecoveryPlan {
  id: string;
  userId: string;
  createdAt: string;
  mode: RecoveryMode;
  situationSummary: {
    whatHappened: string;
    why: string;
    message: string;
  };
  criticalCommitments: string[];
  flexibleCommitments: string[];
  suggestedTradeoffs: SuggestedTradeoff[];
  newWeeklyPlan: RebuiltTask[];
  expectedRecovery: {
    confidenceBefore: number;
    confidenceAfter: number;
    timeRecoveredHours: number;
    stressReductionEstimate: "low" | "medium" | "high";
  };
  status: "proposed" | "accepted" | "rejected";
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

export interface ActivationSession {
  id: string;
  userId: string;
  taskId: string;
  subtaskId?: string; // Optional if targeting a specific subtask
  microMissionTitle: string; // "Read first page"
  estimatedMinutes: number;
  status: "pending" | "active" | "completed" | "failed" | "snoozed";
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  shrinkLevel: number; // How many times it was made "smaller"
}

export interface UserAnalytics {
  userId: string;
  activationSessionsCompleted: number;
  microTasksCompleted: number;
  averageActivationTimeSeconds: number;
  largestTaskReducedToMicro: number;
  procrastinationRecoveredCount: number;
  focusMinutesTotal: number;
  currentStreak: number;
  momentumScore: number;
  lastActivationDate?: string;
  todayWins: number;
  timeSavedMinutes: number;
}

export type BehaviourState = 
  | "highly_engaged" 
  | "building_momentum" 
  | "passive" 
  | "overwhelmed" 
  | "burned_out" 
  | "deadline_crisis";

export interface NotificationLog {
  id: string;
  timestamp: string;
  type: string; // e.g., "activation_prompt", "standard_reminder", "pacing_alert"
  status: "sent" | "engaged" | "ignored" | "dismissed";
  engagedAt?: string;
}

export type CompanionType = "guardian" | "commander" | "strategist" | "mentor" | "challenger";

export interface CompanionProfile {
  userId: string;
  activeCompanion: CompanionType;
  coachingStyle: string; // e.g., "supportive", "direct", "analytical"
  motivationStyle: string; // e.g., "gentle", "high_accountability", "educational"
  communicationDensity: "low" | "medium" | "high";
  celebrationStyle: "minimal" | "enthusiastic" | "analytical" | "aggressive";
  pressureTolerance: "low" | "medium" | "high";
  // Analytics
  companionEffectiveness: number; // 0-100
  recentAdaptations: string[];
}

export interface UserEngagement {
  userId: string;
  engagementScore: number; // 0 to 100
  behaviourState: BehaviourState;
  engagementHistory: { timestamp: string; score: number }[];
  notificationHistory: NotificationLog[];
  notificationAcceptanceRate: number; // percentage
  averageResponseDelaySeconds: number;
  quietHours: {
    enabled: boolean;
    start: string; // e.g. "22:00"
    end: string;   // e.g. "08:00"
  };
  burnoutSignals: string[]; // ISO timestamps of overload signals
  focusConsistency: number; // 0 to 100 score on task completion pattern
  consecutiveIgnoredCount: number; // tracker for back-off delay logic
  nextAllowedNotificationTime?: string; // back-off lock
  lastInteractionTime?: string;
}

export type BehavioralEventType =
  | "TASK_CREATED"
  | "TASK_STARTED"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "TASK_SNOOZED"
  | "TASK_DELETED"
  | "RECOVERY_ACCEPTED"
  | "RECOVERY_REJECTED"
  | "TELEGRAM_REPLY"
  | "TELEGRAM_IGNORE"
  | "VOICE_CONVERSATION"
  | "DASHBOARD_SESSION"
  | "FOCUS_SESSION_STARTED"
  | "FOCUS_SESSION_COMPLETED"
  | "CALENDAR_SYNC"
  | "OCR_IMPORT"
  | "MORNING_BRIEF_VIEWED"
  | "EVENING_REFLECTION_VIEWED"
  | "ACTIVATION_STARTED"
  | "ACTIVATION_COMPLETED"
  | "ACTIVATION_ABANDONED";

export interface BehavioralEvent {
  id: string;
  userId: string;
  timestamp: string;
  eventType: BehavioralEventType;
  taskCategory?: string;
  subject?: string;
  durationMinutes?: number;
  completionState?: "success" | "partial" | "failed" | "abandoned";
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface LearnedAttribute {
  value: any;
  confidence: number;
  evidenceCount: number;
  lastUpdated: string;
  source: string;
}

export interface AdaptivePlanningState {
  currentStrategy: PlanningStrategy;
  planningAccuracy: number;
  estimateAccuracy: number;
  adaptiveImprovements: number;
  recoveredHours: number;
  planningConfidence: number;
  historicalSuccess: number;
  averageScheduleStability: number;
  behaviorInfluence: number;
  lastOptimized: string;
  hasSufficientData?: boolean;
  dataStatus?: "INSUFFICIENT_DATA" | "SUFFICIENT_DATA";
  completionRate?: number;
  onTimeRate?: number;
  averageDelayMinutes?: number;
}

export interface LearningProfile {
  userId: string;
  preferredWorkHours?: LearnedAttribute;
  preferredStudyWindow?: LearnedAttribute;
  mostProductiveWeekday?: LearnedAttribute;
  averageFocusDurationMinutes?: LearnedAttribute;
  longestSuccessfulFocusDurationMinutes?: LearnedAttribute;
  averageBreakDurationMinutes?: LearnedAttribute;
  averageCompletionConfidence?: LearnedAttribute;
  averageEstimationErrorPercent?: LearnedAttribute;
  averageProcrastinationDelayDays?: LearnedAttribute;
  mostDelayedSubject?: LearnedAttribute;
  mostDelayedProject?: LearnedAttribute;
  mostSuccessfulCategory?: LearnedAttribute;
  mostSuccessfulTaskSize?: LearnedAttribute;
  averageDailyWorkloadMinutes?: LearnedAttribute;
  preferredWorkloadDensity?: LearnedAttribute;
  preferredCoachingStyle?: LearnedAttribute;
  preferredCommunicationStyle?: LearnedAttribute;
  preferredRecoveryMode?: LearnedAttribute;
  responseRateTelegram?: LearnedAttribute;
  responseRateVoice?: LearnedAttribute;
  recoverySuccessRate?: LearnedAttribute;
  riskTolerance?: LearnedAttribute;
  sleepSchedule?: LearnedAttribute;
  weeklyConsistencyScore?: LearnedAttribute;
  learningConfidence: number;
  lastUpdated: string;
}

export type RecurringCompletionMode = "binary" | "progress" | "timer" | "count" | "custom";
export type RecurringRepeatRule = "daily" | "weekdays" | "weekends" | "weekly" | "biweekly" | "monthly" | "yearly" | "custom";

export interface RecurringCommitment {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category?: string;
  priority: "low" | "medium" | "high";
  
  completionMode: RecurringCompletionMode;
  goalValue?: number; // e.g., 4 for DSA, 20 for pages
  goalUnit?: string;  // e.g., "Questions", "Pages", "Liters", "Minutes"
  
  repeatRule: RecurringRepeatRule;
  customRuleContext?: string; // If custom, store RRULE or description

  preferredTime?: string;
  preferredFocusWindow?: string;
  softDeadline?: string;
  hardDeadline?: string;
  estimatedDurationMinutes: number;

  activationEnabled: boolean;
  recoveryEnabled: boolean;
  telegramEnabled: boolean;
  calendarEnabled: boolean;
  behaviorLearningEnabled: boolean;
  autoReschedule: boolean;

  skipAllowance: number;
  skipCount: number;
  monthlySkipBudget: number;

  currentStreak: number;
  longestStreak: number;
  consistencyPercent: number;
  averageCompletionTime?: string;
  averageDelayMinutes?: number;
  averageDurationMinutes?: number;
  behaviorConfidence: number;

  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export type RecurringInstanceStatus = "pending" | "active" | "completed" | "failed" | "skipped" | "recovered";

export interface RecurringInstance {
  id: string;
  userId: string;
  commitmentId: string;
  date: string; // YYYY-MM-DD
  
  title: string;
  
  status: RecurringInstanceStatus;
  
  progressValue: number; // For progress/count based
  goalValue: number;
  goalUnit: string;
  
  estimatedDurationMinutes: number;
  actualDurationMinutes?: number;
  
  scheduledStart?: string;
  scheduledEnd?: string;
  
  startedAt?: string;
  completedAt?: string;
  
  recoveryId?: string; // If this instance went through recovery
  
  createdAt: string;
  updatedAt: string;
}

