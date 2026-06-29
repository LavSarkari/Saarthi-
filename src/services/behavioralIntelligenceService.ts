import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  BehavioralEvent,
  BehavioralEventType,
  LearningProfile,
  LearnedAttribute,
} from "../types";

export const behavioralIntelligenceService = {
  /**
   * Tracks a behavioral event and triggers async learning updates.
   */
  async trackEvent(
    eventData: Omit<BehavioralEvent, "id" | "timestamp">
  ): Promise<void> {
    if (eventData.userId === "sandbox_sim_luv_sarkari_gmail_com") return;
    try {
      const event: BehavioralEvent = {
        ...eventData,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      // In a real production app, we would write this to a subcollection
      const eventsRef = collection(db, "users", event.userId, "behavioralEvents");
      await addDoc(eventsRef, event);

      // Trigger profile recalculation based on the new event
      // We don't await this to keep tracking fast
      this.processLearningRules(event.userId).catch((err) =>
        console.error("Failed to process learning rules:", err)
      );
    } catch (error) {
      console.error("Error tracking behavioral event:", error);
    }
  },

  /**
   * Retrieves the current Learning Profile for a user.
   */
  async getLearningProfile(userId: string): Promise<LearningProfile | null> {
    if (userId === "sandbox_sim_luv_sarkari_gmail_com") return null;
    try {
      const profileRef = doc(db, "users", userId, "learningProfile", "current");
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        return snap.data() as LearningProfile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching learning profile:", error);
      return null;
    }
  },

  /**
   * Generates a default/empty Learning Profile
   */
  generateDefaultProfile(userId: string): LearningProfile {
    return {
      userId,
      learningConfidence: 0,
      lastUpdated: new Date().toISOString(),
    };
  },

  /**
   * Processes all events for a user and updates their Learning Profile.
   * This is a deterministic learning engine.
   */
  async processLearningRules(userId: string): Promise<void> {
    if (userId === "sandbox_sim_luv_sarkari_gmail_com") return;
    try {
      const eventsRef = collection(db, "users", userId, "behavioralEvents");
      // For performance in prototype, we just grab all events. 
      // In production we would process incrementally or use Cloud Functions.
      const q = query(eventsRef, orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const events = snapshot.docs.map((d) => d.data() as BehavioralEvent);

      if (events.length === 0) return;

      const profile = (await this.getLearningProfile(userId)) || this.generateDefaultProfile(userId);
      const now = new Date().toISOString();
      let updated = false;

      // Rule 1: Preferred Work Hours
      const taskCompletions = events.filter((e) => e.eventType === "TASK_COMPLETED");
      if (taskCompletions.length >= 5) {
        const hours = taskCompletions.map((e) => new Date(e.timestamp).getHours());
        const nightCount = hours.filter((h) => h >= 18 || h < 4).length;
        const morningCount = hours.filter((h) => h >= 5 && h < 12).length;
        
        let value = "Flexible";
        let source = "Mixed observation";
        if (nightCount / taskCompletions.length > 0.6) {
          value = "Night (6 PM - 4 AM)";
          source = `Observed across ${nightCount} successful completions at night.`;
        } else if (morningCount / taskCompletions.length > 0.6) {
          value = "Morning (5 AM - 12 PM)";
          source = `Observed across ${morningCount} successful completions in the morning.`;
        }

        profile.preferredWorkHours = {
          value,
          confidence: Math.min(100, taskCompletions.length * 5),
          evidenceCount: taskCompletions.length,
          lastUpdated: now,
          source,
        };
        updated = true;
      }

      // Rule 2: Optimal Focus Duration
      const focusSessions = events.filter((e) => e.eventType === "FOCUS_SESSION_COMPLETED");
      if (focusSessions.length >= 3) {
        const successful = focusSessions.filter(
          (e) => e.completionState === "success" || e.completionState === "partial"
        );
        if (successful.length > 0) {
          const totalMins = successful.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
          const avgMins = Math.round(totalMins / successful.length);
          const longest = Math.max(...successful.map((e) => e.durationMinutes || 0));

          profile.averageFocusDurationMinutes = {
            value: avgMins,
            confidence: Math.min(100, successful.length * 10),
            evidenceCount: successful.length,
            lastUpdated: now,
            source: `Calculated from ${successful.length} successful focus sessions.`,
          };
          
          profile.longestSuccessfulFocusDurationMinutes = {
            value: longest,
            confidence: Math.min(100, successful.length * 10),
            evidenceCount: successful.length,
            lastUpdated: now,
            source: `Observed max duration without failure.`,
          };
          updated = true;
        }
      }

      // Rule 3: Recovery Effectiveness
      const recoveryAccepted = events.filter((e) => e.eventType === "RECOVERY_ACCEPTED").length;
      const recoveryRejected = events.filter((e) => e.eventType === "RECOVERY_REJECTED").length;
      const totalRecovery = recoveryAccepted + recoveryRejected;
      
      if (totalRecovery >= 3) {
        const rate = Math.round((recoveryAccepted / totalRecovery) * 100);
        profile.recoverySuccessRate = {
          value: rate,
          confidence: Math.min(100, totalRecovery * 10),
          evidenceCount: totalRecovery,
          lastUpdated: now,
          source: `Based on ${totalRecovery} recovery suggestions.`,
        };
        updated = true;
      }

      // Calculate overall learning confidence based on evidence count across all attributes
      let totalEvidence = 0;
      let attributeCount = 0;
      Object.values(profile).forEach((val) => {
        if (val && typeof val === 'object' && 'evidenceCount' in val) {
          totalEvidence += (val as LearnedAttribute).evidenceCount;
          attributeCount++;
        }
      });
      
      if (attributeCount > 0) {
         profile.learningConfidence = Math.min(100, Math.round(totalEvidence * 2));
      }

      if (updated) {
        profile.lastUpdated = now;
        const profileRef = doc(db, "users", userId, "learningProfile", "current");
        await setDoc(profileRef, profile, { merge: true });
      }
    } catch (error) {
      console.error("Error processing learning rules:", error);
    }
  },

  /**
   * Generates a context summary string for AI prompts.
   */
  generateAiContext(profile: LearningProfile | null): string {
    if (!profile) return "No behavioral intelligence data available yet.";

    const lines: string[] = ["Behavioral Intelligence Context:"];
    
    if (profile.preferredWorkHours) {
      lines.push(`• Best work window: ${profile.preferredWorkHours.value}`);
    }
    
    if (profile.averageFocusDurationMinutes) {
      lines.push(`• Optimal focus duration: ${profile.averageFocusDurationMinutes.value} minutes`);
    }

    if (profile.recoverySuccessRate) {
      if (profile.recoverySuccessRate.value > 60) {
        lines.push(`• Recovery plans are highly effective (${profile.recoverySuccessRate.value}% acceptance)`);
      } else {
        lines.push(`• Recovery plans are rarely accepted (${profile.recoverySuccessRate.value}% acceptance)`);
      }
    }
    
    if (profile.mostDelayedSubject) {
      lines.push(`• ${profile.mostDelayedSubject.value} tasks are frequently delayed`);
    }

    if (profile.learningConfidence > 0) {
       lines.push(`• Overall AI Profile Confidence: ${profile.learningConfidence}%`);
    }

    if (lines.length === 1) {
      return "Collecting behavioral intelligence data...";
    }

    return lines.join("\n");
  }
};
