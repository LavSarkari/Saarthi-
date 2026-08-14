import { Task, AdaptivePlanningState, PlanningStrategy, LearningProfile } from "../types.js";
import { db } from "../lib/firebase.js";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const MIN_REQUIRED_SAMPLES = 3;

export class AdaptivePlanningService {
  /**
   * Deterministically calculates historical adaptive planning state from observable task history.
   * Eliminates 100% of fake Math.random() values.
   */
  public computeDeterministicState(
    tasks: Task[],
    strategy: PlanningStrategy = "balanced",
    nowInput: Date | string = new Date()
  ): AdaptivePlanningState {
    const now = typeof nowInput === "string" ? new Date(nowInput) : nowInput;
    const nowIso = isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();

    // Sort tasks deterministically by ID for 100% input-order independence
    const sortedTasks = [...tasks].sort((a, b) => a.id.localeCompare(b.id));
    const totalTasks = sortedTasks.length;

    if (totalTasks === 0) {
      return {
        currentStrategy: strategy,
        planningAccuracy: 0,
        estimateAccuracy: 0,
        adaptiveImprovements: 0,
        recoveredHours: 0,
        planningConfidence: 0,
        historicalSuccess: 0,
        averageScheduleStability: 100,
        behaviorInfluence: 0,
        lastOptimized: nowIso,
        hasSufficientData: false,
        dataStatus: "INSUFFICIENT_DATA",
        completionRate: 0,
        onTimeRate: 0,
        averageDelayMinutes: 0,
      };
    }

    const completedTasks = sortedTasks.filter(
      (t) => t.isCompleted || (t.subtasks && t.subtasks.length > 0 && t.subtasks.every((s) => s.done))
    );
    const sampleSize = completedTasks.length;

    // Evaluate delay attribution (excluding dependency-blocked or calendar-conflict delays from user fault)
    let totalDelayMinutes = 0;
    let delayedTaskCount = 0;
    let onTimeCount = 0;
    let userCausedMisses = 0;

    for (const t of sortedTasks) {
      const deadlineMs = new Date(t.deadline).getTime();
      const isDone = t.isCompleted || (t.subtasks && t.subtasks.every((s) => s.done));

      if (isDone) {
        // Find last subtask scheduled end or creation time as completion approximation
        const lastSubEnd = [...(t.subtasks || [])].reverse().find((s) => s.scheduledEnd)?.scheduledEnd;
        const completionTimeMs = lastSubEnd ? new Date(lastSubEnd).getTime() : new Date(t.createdAt || 0).getTime();

        if (completionTimeMs <= deadlineMs) {
          onTimeCount++;
        } else {
          const delayMins = Math.round((completionTimeMs - deadlineMs) / 60000);
          totalDelayMinutes += delayMins;
          delayedTaskCount++;
        }
      } else if (now.getTime() > deadlineMs) {
        // Check attribution: if task has pending dependsOn, it was blocked by dependency (not user failure)
        const isBlockedByDependency = t.dependsOn && t.dependsOn.some((depId) => {
          const depTask = sortedTasks.find((parent) => parent.id === depId);
          return depTask && !depTask.isCompleted;
        });

        if (!isBlockedByDependency) {
          userCausedMisses++;
        }
      }
    }

    const completionRate = Math.round((sampleSize / totalTasks) * 100);
    const onTimeRate = sampleSize > 0 ? Math.round((onTimeCount / sampleSize) * 100) : 0;
    const averageDelayMinutes = delayedTaskCount > 0 ? Math.round(totalDelayMinutes / delayedTaskCount) : 0;

    const hasSufficientData = sampleSize >= MIN_REQUIRED_SAMPLES;
    const dataStatus = hasSufficientData ? "SUFFICIENT_DATA" : "INSUFFICIENT_DATA";

    // Estimate Accuracy: Compare total effort estimated vs actual sessions completed ratio
    let totalEstimatedMinutes = 0;
    let totalActualMinutes = 0;
    for (const ct of completedTasks) {
      totalEstimatedMinutes += ct.totalEffortMinutes || 60;
      const doneMinutes = ct.subtasks.filter((s) => s.done).reduce((acc, s) => acc + (s.estimatedMinutes || 45), 0);
      totalActualMinutes += doneMinutes;
    }

    let estimateAccuracy = 100;
    if (totalEstimatedMinutes > 0) {
      const diffRatio = Math.abs(totalActualMinutes - totalEstimatedMinutes) / totalEstimatedMinutes;
      estimateAccuracy = Math.max(0, Math.round((1 - diffRatio) * 100));
    }

    // Planning Confidence derived deterministically from sample size and on-time adherence
    const sampleFactor = Math.min(1.0, sampleSize / MIN_REQUIRED_SAMPLES);
    const planningConfidence = Math.round(sampleFactor * (0.5 * completionRate + 0.5 * onTimeRate));
    const planningAccuracy = Math.round(0.6 * onTimeRate + 0.4 * estimateAccuracy);
    const behaviorInfluence = Math.round(sampleFactor * 100);
    const recoveredHours = Math.round((sampleSize * 45) / 60);

    return {
      currentStrategy: strategy,
      planningAccuracy: hasSufficientData ? planningAccuracy : 0,
      estimateAccuracy: hasSufficientData ? estimateAccuracy : 0,
      adaptiveImprovements: sampleSize,
      recoveredHours: hasSufficientData ? recoveredHours : 0,
      planningConfidence,
      historicalSuccess: completionRate,
      averageScheduleStability: Math.max(50, 100 - Math.min(50, userCausedMisses * 10)),
      behaviorInfluence,
      lastOptimized: nowIso,
      hasSufficientData,
      dataStatus,
      completionRate,
      onTimeRate,
      averageDelayMinutes,
    };
  }

  /**
   * Deterministically calculates adapted task duration from historical category actuals using Median with Outlier Capping.
   */
  public getAdaptedDuration(
    category: string | undefined,
    requestedMinutes: number,
    historyTasks: Task[]
  ): { adaptedMinutes: number; sampleCount: number; isAdapted: boolean } {
    if (!category || requestedMinutes <= 0 || historyTasks.length === 0) {
      return { adaptedMinutes: requestedMinutes, sampleCount: 0, isAdapted: false };
    }

    const catTasks = historyTasks.filter(
      (t) => (t.category === category || t.title.toLowerCase().includes(category.toLowerCase())) &&
             (t.isCompleted || (t.subtasks && t.subtasks.every((s) => s.done)))
    );

    if (catTasks.length < MIN_REQUIRED_SAMPLES) {
      return { adaptedMinutes: requestedMinutes, sampleCount: catTasks.length, isAdapted: false };
    }

    // Gather historical actual durations
    const actualDurations: number[] = [];
    for (const t of catTasks) {
      const actualMins = t.subtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 45), 0);
      actualDurations.push(actualMins);
    }

    actualDurations.sort((a, b) => a - b);

    // Compute Median
    let median: number;
    const mid = Math.floor(actualDurations.length / 2);
    if (actualDurations.length % 2 === 0) {
      median = (actualDurations[mid - 1] + actualDurations[mid]) / 2;
    } else {
      median = actualDurations[mid];
    }

    // Outlier Capping: Clamp adapted duration between 0.5x and 2.0x of requested
    const minBound = Math.round(requestedMinutes * 0.5);
    const maxBound = Math.round(requestedMinutes * 2.0);
    const adaptedMinutes = Math.max(minBound, Math.min(maxBound, Math.round(median)));

    return {
      adaptedMinutes,
      sampleCount: actualDurations.length,
      isAdapted: true,
    };
  }

  async getPlanningState(userId: string, tasks: Task[] = []): Promise<AdaptivePlanningState> {
    const calculatedState = this.computeDeterministicState(tasks);

    if (userId === "sandbox_sim_luv_sarkari_gmail_com") {
      return calculatedState;
    }
    try {
      const docRef = doc(db, "adaptivePlanning", userId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, calculatedState);
        return calculatedState;
      }
      return { ...snap.data(), ...calculatedState } as AdaptivePlanningState;
    } catch (e) {
      return calculatedState;
    }
  }

  async updatePlanningState(userId: string, updates: Partial<AdaptivePlanningState>): Promise<void> {
    if (userId === "sandbox_sim_luv_sarkari_gmail_com") return;
    try {
      const docRef = doc(db, "adaptivePlanning", userId);
      await updateDoc(docRef, { ...updates, lastOptimized: new Date().toISOString() });
    } catch (e) {
      // Graceful fallback for non-Firebase environments
    }
  }

  async regeneratePlan(
    userId: string,
    tasks: Task[],
    learningProfile: LearningProfile | null,
    strategy: PlanningStrategy,
    triggerReason: string,
    nowInput: Date | string = new Date()
  ): Promise<{ updatedTasks: Task[]; insights: string[]; state: AdaptivePlanningState }> {
    let preferredStartHour = 9;
    let preferredEndHour = 17;
    let maxFocusDuration = 90;

    if (!learningProfile) {
      try {
        const { behavioralIntelligenceService } = await import("./behavioralIntelligenceService.js");
        learningProfile = await behavioralIntelligenceService.getLearningProfile(userId);
      } catch (e) {}
    }

    if (learningProfile) {
      if (learningProfile.preferredWorkHours?.value) {
        const val = String(learningProfile.preferredWorkHours.value);
        if (val.includes("evening") || val.includes("Night")) {
          preferredStartHour = 18;
          preferredEndHour = 23;
        }
      }
      if (learningProfile.averageFocusDurationMinutes?.value) {
        maxFocusDuration = parseInt(String(learningProfile.averageFocusDurationMinutes.value), 10) || 90;
      }
    }

    const insights: string[] = [];
    insights.push(`Adaptive planning initialized for ${triggerReason}.`);
    insights.push(`Using strategy: ${strategy.replace('_', ' ').toUpperCase()}`);

    const state = this.computeDeterministicState(tasks, strategy, nowInput);

    if (state.hasSufficientData) {
      insights.push(`Historical Signal: Completion Rate ${state.completionRate}%, On-Time Rate ${state.onTimeRate}%.`);
    } else {
      insights.push(`Historical Signal: INSUFFICIENT_DATA (Sample size: ${state.adaptiveImprovements}/${MIN_REQUIRED_SAMPLES}). Defaulting to standard baseline.`);
    }

    try {
      const res = await fetch("/api/gemini/adaptive-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tasks, strategy, maxFocusDuration, preferredStartHour, preferredEndHour }),
      });

      if (!res.ok) throw new Error("Failed to adaptive schedule");
      const result = await res.json();

      if (result.insights && result.insights.length) {
        insights.push(...result.insights);
      }

      await this.updatePlanningState(userId, state);
      return { updatedTasks: result.updatedTasks || tasks, insights, state };
    } catch (e) {
      await this.updatePlanningState(userId, state);
      return { updatedTasks: tasks, insights, state };
    }
  }
}

export const adaptivePlanningService = new AdaptivePlanningService();
