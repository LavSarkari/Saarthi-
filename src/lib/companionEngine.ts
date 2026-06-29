import { CompanionProfile, UserEngagement } from "../types";

export function evaluateCompanionAdaptation(
  engagement: UserEngagement,
  profile: CompanionProfile
): Partial<CompanionProfile> | null {
  const updates: Partial<CompanionProfile> = {};
  const recentAdaptations: string[] = [...(profile.recentAdaptations || [])];

  // If user is constantly ignoring notifications, maybe the tone is too harsh or density too high.
  if (engagement.consecutiveIgnoredCount >= 3) {
    if (profile.communicationDensity === "high") {
      updates.communicationDensity = "medium";
      recentAdaptations.unshift("Reduced communication density due to ignored notifications.");
    } else if (profile.activeCompanion === "commander") {
      updates.activeCompanion = "strategist";
      updates.coachingStyle = "analytical";
      updates.motivationStyle = "logic";
      recentAdaptations.unshift("Switched to Strategist: Commander tone was generating resistance.");
    } else if (profile.activeCompanion === "challenger") {
      updates.activeCompanion = "mentor";
      recentAdaptations.unshift("Switched to Mentor: Lowering competitive pressure to encourage engagement.");
    }
  }

  // If user is highly engaged with Guardian, we might keep it but increase density if they act fast
  if (engagement.behaviourState === "highly_engaged" && profile.activeCompanion === "guardian") {
    if (profile.communicationDensity === "low") {
      updates.communicationDensity = "medium";
      recentAdaptations.unshift("Increased communication density based on high engagement.");
    }
  }
  
  // If user is overwhelmed and using Commander, soften it to Guardian
  if (engagement.behaviourState === "overwhelmed" && (profile.activeCompanion === "commander" || profile.activeCompanion === "challenger")) {
    updates.activeCompanion = "guardian";
    updates.coachingStyle = "supportive";
    updates.motivationStyle = "gentle";
    updates.pressureTolerance = "low";
    recentAdaptations.unshift("Switched to Guardian: Detected overwhelm, providing a safer space.");
  }

  // Calculate effectiveness score
  let effectiveness = profile.companionEffectiveness || 80;
  if (engagement.behaviourState === "highly_engaged") {
    effectiveness = Math.min(100, effectiveness + 5);
  } else if (engagement.behaviourState === "passive") {
    effectiveness = Math.max(0, effectiveness - 2);
  } else if (engagement.behaviourState === "overwhelmed") {
    effectiveness = Math.max(0, effectiveness - 5);
  }
  
  if (effectiveness !== profile.companionEffectiveness) {
    updates.companionEffectiveness = effectiveness;
  }

  if (Object.keys(updates).length > 0) {
    // Keep max 5 adaptations
    if (updates.activeCompanion) {
      updates.recentAdaptations = recentAdaptations.slice(0, 5);
    }
    return updates;
  }

  return null;
}
