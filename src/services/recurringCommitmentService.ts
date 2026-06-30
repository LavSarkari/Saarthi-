import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  runTransaction 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { RecurringCommitment, RecurringInstance, RecurringInstanceStatus } from "../types";

export class RecurringCommitmentService {
  private commitmentsCollection = "RecurringCommitments";
  private instancesCollection = "RecurringInstances";

  /**
   * Generates a unique ID
   */
  private generateId(prefix: string = "rc_"): string {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Helper to format a date to YYYY-MM-DD in local time
   */
  private getLocalDateString(date: Date = new Date()): string {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, -1);
    return localISOTime.split("T")[0];
  }

  /**
   * Check if an instance should be generated for a commitment on a given date string (YYYY-MM-DD)
   */
  private shouldGenerateInstance(commitment: RecurringCommitment, dateStr: string): boolean {
    const dateObj = new Date(dateStr + "T00:00:00"); // Local date
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday

    switch (commitment.repeatRule) {
      case "daily":
        return true;
      case "weekdays":
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case "weekends":
        return dayOfWeek === 0 || dayOfWeek === 6;
      case "weekly":
        // For simplicity, assuming weekly means the day of the week it was created, or preferred
        // In a real robust system, we would store preferred days. Let's just say true if it's the same day of week as creation
        const createdDay = new Date(commitment.createdAt).getDay();
        return dayOfWeek === createdDay;
      default:
        return true; // fallback
    }
  }

  /**
   * Create a new recurring commitment
   */
  async createCommitment(userId: string, data: Partial<RecurringCommitment>): Promise<RecurringCommitment> {
    const id = this.generateId("rc_");
    const now = new Date().toISOString();

    const commitment: RecurringCommitment = {
      id,
      userId,
      title: data.title || "New Commitment",
      description: data.description || "",
      category: data.category || "General",
      priority: data.priority || "medium",
      completionMode: data.completionMode || "binary",
      goalValue: data.goalValue || 1,
      goalUnit: data.goalUnit || "Times",
      repeatRule: data.repeatRule || "daily",
      customRuleContext: data.customRuleContext || "",
      preferredTime: data.preferredTime || "",
      preferredFocusWindow: data.preferredFocusWindow || "",
      softDeadline: data.softDeadline || "",
      hardDeadline: data.hardDeadline || "",
      estimatedDurationMinutes: data.estimatedDurationMinutes || 15,
      activationEnabled: data.activationEnabled !== undefined ? data.activationEnabled : true,
      recoveryEnabled: data.recoveryEnabled !== undefined ? data.recoveryEnabled : true,
      telegramEnabled: data.telegramEnabled !== undefined ? data.telegramEnabled : true,
      calendarEnabled: data.calendarEnabled !== undefined ? data.calendarEnabled : false,
      behaviorLearningEnabled: data.behaviorLearningEnabled !== undefined ? data.behaviorLearningEnabled : true,
      autoReschedule: data.autoReschedule !== undefined ? data.autoReschedule : false,
      skipAllowance: data.skipAllowance || 0,
      skipCount: 0,
      monthlySkipBudget: data.monthlySkipBudget || 0,
      currentStreak: 0,
      longestStreak: 0,
      consistencyPercent: 100,
      behaviorConfidence: 100,
      createdAt: now,
      updatedAt: now,
      archived: false,
    };

    await setDoc(doc(db, this.commitmentsCollection, id), commitment);

    // After creating, automatically trigger generation for today
    await this.generateDailyInstances(userId);

    return commitment;
  }

  /**
   * Generates instances for today for all active commitments.
   */
  async generateDailyInstances(userId: string, dateStr?: string): Promise<RecurringInstance[]> {
    const targetDateStr = dateStr || this.getLocalDateString();

    const q = query(
      collection(db, this.commitmentsCollection),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);
    const commitments = snapshot.docs
      .map(doc => doc.data() as RecurringCommitment)
      .filter(c => !c.archived);

    // Check existing instances to avoid duplicates
    const instancesQ = query(
      collection(db, this.instancesCollection),
      where("userId", "==", userId)
    );
    const instancesSnap = await getDocs(instancesQ);
    const existingInstances = instancesSnap.docs
      .map(d => d.data() as RecurringInstance)
      .filter(i => i.date === targetDateStr);
    
    const activeCommitmentIds = new Set(commitments.map(c => c.id));
    const validExistingInstances = existingInstances.filter(i => activeCommitmentIds.has(i.commitmentId));
    
    const existingInstanceCommitmentIds = new Set(validExistingInstances.map(d => d.commitmentId));

    const newInstances: RecurringInstance[] = [];

    for (const commitment of commitments) {
      if (!existingInstanceCommitmentIds.has(commitment.id) && this.shouldGenerateInstance(commitment, targetDateStr)) {
        const instanceId = this.generateId("ri_");
        const instance: RecurringInstance = {
          id: instanceId,
          userId,
          commitmentId: commitment.id,
          date: targetDateStr,
          title: commitment.title,
          status: "pending",
          progressValue: 0,
          goalValue: commitment.goalValue || 1,
          goalUnit: commitment.goalUnit || "Times",
          estimatedDurationMinutes: commitment.estimatedDurationMinutes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newInstances.push(instance);
        // Save to Firestore
        await setDoc(doc(db, this.instancesCollection, instanceId), instance);
      }
    }

    const allInstances = [...validExistingInstances, ...newInstances];
    return allInstances;
  }

  /**
   * Fetch instances for a specific date
   */
  async getInstancesForDate(userId: string, dateStr: string): Promise<RecurringInstance[]> {
    const q = query(
      collection(db, this.instancesCollection),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => doc.data() as RecurringInstance)
      .filter(i => i.date === dateStr);
  }
  
  /**
   * Fetch all commitments
   */
  async getCommitments(userId: string): Promise<RecurringCommitment[]> {
    const q = query(
      collection(db, this.commitmentsCollection),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => doc.data() as RecurringCommitment)
      .filter(c => !c.archived);
  }

  /**
   * Update instance progress or status
   */
  async updateInstanceStatus(
    instanceId: string, 
    status: RecurringInstanceStatus, 
    progressValue?: number
  ): Promise<void> {
    const instanceRef = doc(db, this.instancesCollection, instanceId);
    const now = new Date().toISOString();
    
    await runTransaction(db, async (transaction) => {
      const instanceDoc = await transaction.get(instanceRef);
      if (!instanceDoc.exists()) throw new Error("Instance not found");
      
      const instance = instanceDoc.data() as RecurringInstance;
      
      const updates: Partial<RecurringInstance> = {
        status,
        updatedAt: now,
      };

      if (progressValue !== undefined) {
        updates.progressValue = progressValue;
        if (progressValue >= instance.goalValue) {
          updates.status = "completed";
          updates.completedAt = now;
        }
      }

      if (status === "active" && !instance.startedAt) {
        updates.startedAt = now;
      } else if (status === "completed") {
        updates.completedAt = now;
      }

      // Check if we will need to update the commitment streak
      const isBecomingCompleted = updates.status === "completed" && instance.status !== "completed";
      const isBecomingFailedOrSkipped = updates.status === "failed" || updates.status === "skipped";
      
      let commitmentDoc = null;
      const commitmentRef = doc(db, this.commitmentsCollection, instance.commitmentId);
      
      // Perform ALL reads before ANY writes
      if (isBecomingCompleted || isBecomingFailedOrSkipped) {
        commitmentDoc = await transaction.get(commitmentRef);
      }

      // Now perform writes
      transaction.update(instanceRef, updates);

      // If completed, update streak in commitment
      if (isBecomingCompleted && commitmentDoc?.exists()) {
        const commitment = commitmentDoc.data() as RecurringCommitment;
        const newStreak = commitment.currentStreak + 1;
        transaction.update(commitmentRef, {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, commitment.longestStreak),
          updatedAt: now,
        });
      } else if (isBecomingFailedOrSkipped && commitmentDoc?.exists()) {
         // Reset streak
         transaction.update(commitmentRef, {
           currentStreak: 0,
           updatedAt: now,
         });
      }
    });
  }

  async archiveCommitment(commitmentId: string): Promise<void> {
    const commitmentRef = doc(db, this.commitmentsCollection, commitmentId);
    await updateDoc(commitmentRef, {
      archived: true,
      updatedAt: new Date().toISOString()
    });
  }

  // TODO: Add methods for AI Recovery OS integration, Behavioral Learning hooks
}

export const recurringCommitmentService = new RecurringCommitmentService();
