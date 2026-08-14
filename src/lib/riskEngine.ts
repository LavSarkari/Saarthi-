import { Task, Subtask, RiskZone } from "../types";

export function getHoursRemaining(deadlineStr: string): number {
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

export function formatTimeRemaining(hours: number): string {
  if (hours <= 0) return "0h";
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  const mins = Math.round((hours % 1) * 60);

  if (days > 0) {
    if (remainingHours > 0) return `${days}d ${remainingHours}h`;
    return `${days}d`;
  }
  if (remainingHours > 0) {
    if (mins > 0) return `${remainingHours}h ${mins}m`;
    return `${remainingHours}h`;
  }
  return `${mins}m`;
}

export interface RiskAnalysis {
  score: number;
  zone: RiskZone;
  completionConfidence: number;
  explanation: {
    primaryReason: string;
    secondaryReason: string;
  };
}

export function computeRiskScore(task: Task | Omit<Task, "riskScore" | "riskZone">): RiskAnalysis {
  const totalSubtasks = task.subtasks.length;
  const completedSubtasks = task.subtasks.filter((s) => s.done).length;
  const actualProgressRatio = totalSubtasks > 0 ? completedSubtasks / totalSubtasks : 0;

  // 1. Progress Velocity
  const now = Date.now();
  const createdAtTime = task.createdAt ? new Date(task.createdAt).getTime() : now - 24 * 3600 * 1000; // default 24h ago
  const deadlineTime = new Date(task.deadline).getTime();
  const totalDurationMs = Math.max(1000, deadlineTime - createdAtTime);
  const timeElapsedMs = Math.max(0, now - createdAtTime);
  const timelineProgressRatio = Math.min(1.0, timeElapsedMs / totalDurationMs);

  const expectedProgress = timelineProgressRatio;
  const velocityDiff = expectedProgress - actualProgressRatio;
  
  let velocityPenalty = 0;
  if (velocityDiff > 0) {
    velocityPenalty = velocityDiff * 35; // max 35 points if completely behind expected pace
  }

  // 2. Schedule Pressure & Buffer Ratio
  const hoursRemaining = getHoursRemaining(task.deadline);
  const totalEffortHours = task.totalEffortMinutes / 60;
  const effortRemainingHours = totalEffortHours * (1.0 - actualProgressRatio);
  const bufferRatio = effortRemainingHours > 0 ? hoursRemaining / effortRemainingHours : 10.0;

  let schedulePressurePenalty = 0;
  let pressureReason = "Favorable buffer ratio";

  if (hoursRemaining <= 0) {
    schedulePressurePenalty = 40;
    pressureReason = "Deadline has passed";
  } else if (bufferRatio < 1.0) {
    schedulePressurePenalty = 35;
    pressureReason = "Insufficient remaining time";
  } else if (bufferRatio < 2.0) {
    // scale from 0 to 30 as buffer drops from 2.0 to 1.0
    schedulePressurePenalty = (2.0 - bufferRatio) * 30;
    pressureReason = "Highly constrained schedule safety margin";
  }

  // Extreme proximity penalty if less than 12h remain and not fully completed
  if (hoursRemaining < 12 && actualProgressRatio < 1.0) {
    schedulePressurePenalty += Math.min(20, (12 - hoursRemaining) * 1.5);
  }

  // 3. Task Complexity Weighting
  let complexityWeight = 1.0;
  let complexityPenalty = 0;
  if (task.complexity === "high") {
    complexityWeight = 1.35;
    complexityPenalty = 15;
  } else if (task.complexity === "medium") {
    complexityWeight = 1.0;
    complexityPenalty = 7;
  } else {
    complexityWeight = 0.7;
    complexityPenalty = 0;
  }

  // Amplify progress and schedule pressure penalties using complexity factor
  const finalVelocityPenalty = velocityPenalty * complexityWeight;
  const finalSchedulePressurePenalty = schedulePressurePenalty * complexityWeight;

  // 4. Missed Commitment Penalty & Consecutive Missed Sessions
  const expectedCompletedCount = Math.floor(totalSubtasks * timelineProgressRatio);
  const missedSessions = Math.max(0, expectedCompletedCount - completedSubtasks);

  // Parse consecutively missed subtasks based on sequential list index or order
  let consecutiveMissedSessions = 0;
  let foundFirstUndone = false;
  
  // Sort subtasks by order index to analyze sequentially
  const sortedSubtasks = [...task.subtasks].sort((a, b) => (a.order || 0) - (b.order || 0));
  for (let i = 0; i < expectedCompletedCount; i++) {
    const s = sortedSubtasks[i];
    if (s && !s.done) {
      if (!foundFirstUndone) {
        foundFirstUndone = true;
      }
      consecutiveMissedSessions++;
    } else if (s && s.done && foundFirstUndone) {
      // break streak if a subsequent task is done
      break;
    }
  }

  const missedCommitmentPenalty = Math.min(25, (missedSessions * 4) + (consecutiveMissedSessions * 6));

  // 5. Recovery Effectiveness Mitigation
  let recoveryMitigation = 0;
  let recoveryConfidenceBoost = 0;
  if (task.recoveryPlan) {
    recoveryMitigation = task.recoveryPlan.isRecovered ? 25 : 15;
    recoveryConfidenceBoost = 20;
  }

  // 6. Phase 5 Commitment Semantics & Bill/Subscription Penalties
  let commitmentTypePenalty = 0;
  const isHard = task.commitmentType === "HARD" || task.isHardDeadline === true;
  if (isHard && hoursRemaining < 24 && actualProgressRatio < 1.0) {
    commitmentTypePenalty += 15;
  }

  if (task.category === "BILL") {
    if (task.paymentStatus === "OVERDUE" || (hoursRemaining <= 0 && task.paymentStatus !== "PAID")) {
      commitmentTypePenalty += 35;
      pressureReason = "Unpaid bill due date passed (OVERDUE)";
    }
  } else if (task.category === "SUBSCRIPTION") {
    if (task.subscriptionStatus === "ACTIVE" && hoursRemaining < 72 && actualProgressRatio < 1.0) {
      commitmentTypePenalty += 15;
      pressureReason = "Upcoming subscription renewal window";
    }
  }

  // --- Compile deterministic Risk Score (0-100) ---
  const baseUndoneRatio = 1.0 - actualProgressRatio;
  const baseRisk = baseUndoneRatio * 35; // starts with up to 35 baseline points based on undone work

  let calculatedScore = baseRisk + finalVelocityPenalty + finalSchedulePressurePenalty + complexityPenalty + missedCommitmentPenalty + commitmentTypePenalty - recoveryMitigation;
  
  // High boundary limiters
  let score = Math.max(0, Math.min(100, Math.round(calculatedScore)));

  // If completely done or paid, risk is strictly 0
  if (actualProgressRatio >= 1.0 || task.paymentStatus === "PAID") {
    score = 0;
  }

  // --- Compile deterministic Completion Confidence (0-100) ---
  const baselineConfidence = actualProgressRatio * 50; // up to 50 based purely on completion work
  
  let safetyCushionBonus = 0;
  if (hoursRemaining > 0 && bufferRatio >= 1.0) {
    safetyCushionBonus = Math.min(1.0, (bufferRatio - 1.0) / 2.0) * 30; // up to 30 points for plenty of buffer ratio
  }

  const complexityConfidenceLoss = task.complexity === "high" ? 10 : task.complexity === "medium" ? 5 : 0;
  const velocityConfidenceLoss = Math.max(0, expectedProgress - actualProgressRatio) * 30;

  let calculatedConfidence = baselineConfidence + safetyCushionBonus - complexityConfidenceLoss - velocityConfidenceLoss + recoveryConfidenceBoost;
  
  // If no remaining effort is needed or bill is paid, confidence is 100%
  let confidence = Math.max(0, Math.min(100, Math.round(calculatedConfidence)));
  if (actualProgressRatio >= 1.0 || task.paymentStatus === "PAID") {
    confidence = 100;
  }

  // Map to compatible RiskZone types
  let zone: RiskZone = "safe";
  if (score >= 70 || (hoursRemaining < 3 && actualProgressRatio < 1.0) || (task.category === "BILL" && task.paymentStatus === "OVERDUE")) {
    zone = "critical";
  } else if (score >= 40) {
    zone = "watch";
  }

  // --- Explanations compilation by identifying highest penalties ---
  const reasons: { name: string; val: number }[] = [
    { name: "Low progress velocity", val: finalVelocityPenalty },
    { name: pressureReason, val: finalSchedulePressurePenalty },
    { name: "Missed consecutive subtasks", val: missedCommitmentPenalty },
    { name: "High complexity impact", val: complexityPenalty }
  ];

  reasons.sort((a, b) => b.val - a.val);

  let primaryReason = "Task execution pacing is optimal";
  let secondaryReason = "Favorable schedule buffer";

  if (actualProgressRatio >= 1.0) {
    primaryReason = "All subtasks completed successfully";
    secondaryReason = "Zero threat detected";
  } else if (reasons[0].val > 2) {
    primaryReason = reasons[0].name;
    if (reasons[1].val > 2) {
      secondaryReason = reasons[1].name;
    } else {
      secondaryReason = "Safety buffer under standard watch";
    }
  }

  return {
    score,
    zone,
    completionConfidence: confidence,
    explanation: {
      primaryReason,
      secondaryReason,
    },
  };
}

