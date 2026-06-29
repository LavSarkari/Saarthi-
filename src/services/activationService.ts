import { GoogleGenAI, Type, Schema } from "@google/genai";
import { mockFirestore as dbAdmin } from "./localDb";
import { Task, Subtask, ActivationSession, UserAnalytics } from "../types";
import { generateContentWithRetryAndFallback } from "./geminiCall";
import { engagementService } from "./engagementService.js";

export class ActivationService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });
  }

  /**
   * Evaluates a task deterministically to check if it's "stuck".
   * Signals:
   * - Hours remaining
   * - Risk Zone
   * - Time since creation or last update
   * - Subtask completion state
   */
  public isTaskStuck(task: Task): boolean {
    if (task.subtasks.every(s => s.done)) return false;

    // Fast heuristics
    if (task.riskZone === "critical") return true;

    const now = new Date().getTime();
    const deadlineTime = new Date(task.deadline).getTime();
    const hoursRemaining = (deadlineTime - now) / (1000 * 60 * 60);

    const createdTime = new Date(task.createdAt).getTime();
    const hoursSinceCreation = (now - createdTime) / (1000 * 60 * 60);

    const hasCompletedAnySubtask = task.subtasks.some(s => s.done);

    // If it's due within 48 hours, has been around for at least 12 hours, and zero progress: stuck.
    if (hoursRemaining < 48 && hoursRemaining > 0 && hoursSinceCreation > 12 && !hasCompletedAnySubtask) {
      return true;
    }

    // If it's medium/high complexity and due soon with no sessions completed
    if (task.complexity !== "low" && hoursRemaining < 72 && task.sessionsCompleted === 0) {
      return true;
    }

    return false;
  }

  /**
   * Analyzes all active tasks for a user and returns a list of "stuck" tasks.
   */
  public async getStuckTasks(userId: string): Promise<Task[]> {
    const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
    const activeTasks = tasksSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Task))
      .filter(t => !t.subtasks.every(s => s.done));

    return activeTasks.filter(t => this.isTaskStuck(t));
  }

  /**
   * Generates a 30s-5m micro action for a given task/subtask.
   */
  public async generateMicroAction(task: Task, currentSubtask?: Subtask, currentActionStr?: string): Promise<{ title: string; estimatedMinutes: number }> {
    const context = currentSubtask ? `Target Subtask: ${currentSubtask.title}` : `Overall Task: ${task.title}`;
    
    let instructions = `You are Saarthi's Activation Engine. The user is procrastinating or stuck on this task.
Your job is to generate the SMALLEST POSSIBLE physical or digital action to break execution paralysis.
The action MUST take between 30 seconds and 5 minutes.
Never ask them to "finish" anything.
Focus on the first atomic step. E.g., "Open textbook", "Create a folder", "Read page 1", "Write one sentence".`;

    if (currentActionStr) {
      instructions += `\n\nThe user felt the previous action ("${currentActionStr}") was still too overwhelming.
You MUST shrink it even further. Make it ridiculously small and easy.`;
    }

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "The tiny micro mission" },
        estimatedMinutes: { type: Type.INTEGER, description: "Estimated time in minutes (1 to 5)" }
      },
      required: ["title", "estimatedMinutes"]
    };

    const response = await generateContentWithRetryAndFallback(this.ai, {
      model: "gemini-3.1-flash-lite", // Fast and cheap for this micro task
      contents: `${context}\nTask Description/Notes: ${task.description || task.notes || "None"}`,
      config: {
        systemInstruction: instructions,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const result = JSON.parse(response.text.trim());
    return {
      title: result.title,
      estimatedMinutes: Math.min(Math.max(result.estimatedMinutes || 3, 1), 5) // Clamp to 1-5 mins
    };
  }

  /**
   * Creates a new ActivationSession in Firestore.
   */
  public async createActivationSession(userId: string, taskId: string, microTitle: string, estimatedMinutes: number, subtaskId?: string, shrinkLevel: number = 0): Promise<ActivationSession> {
    const docRef = dbAdmin.collection("activationSessions").doc();
    const session: ActivationSession = {
      id: docRef.id,
      userId,
      taskId,
      subtaskId,
      microMissionTitle: microTitle,
      estimatedMinutes,
      status: "pending",
      shrinkLevel,
      createdAt: new Date().toISOString()
    };
    await docRef.set(session);
    return session;
  }

  /**
   * Completes an ActivationSession and updates Analytics
   */
  public async completeActivationSession(userId: string, sessionId: string): Promise<UserAnalytics> {
    const sessionRef = dbAdmin.collection("activationSessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) throw new Error("Session not found");

    const session = sessionSnap.data() as ActivationSession;
    if (session.status === "completed") throw new Error("Already completed");

    await sessionRef.update({
      status: "completed",
      completedAt: new Date().toISOString()
    });

    // Record interaction in the Engagement Engine
    await engagementService.recordInteraction(userId, "micro_task_complete").catch(err => {
      console.error("Failed to record engagement interaction on session complete:", err);
    });

    // Update Analytics
    return await this.incrementAnalytics(userId, {
      activationSessionsCompleted: 1,
      microTasksCompleted: 1,
      focusMinutesTotal: session.estimatedMinutes,
      todayWins: 1
    });
  }

  public async getAnalytics(userId: string): Promise<UserAnalytics> {
    const ref = dbAdmin.collection("userAnalytics").doc(userId);
    const snap = await ref.get();
    if (snap.exists) return snap.data() as UserAnalytics;

    const defaultAnalytics: UserAnalytics = {
      userId,
      activationSessionsCompleted: 0,
      microTasksCompleted: 0,
      averageActivationTimeSeconds: 0,
      largestTaskReducedToMicro: 0,
      procrastinationRecoveredCount: 0,
      focusMinutesTotal: 0,
      currentStreak: 0,
      momentumScore: 0,
      todayWins: 0,
      timeSavedMinutes: 0
    };
    await ref.set(defaultAnalytics);
    return defaultAnalytics;
  }

  private async incrementAnalytics(userId: string, increments: Partial<UserAnalytics>): Promise<UserAnalytics> {
    const current = await this.getAnalytics(userId);
    const updated: UserAnalytics = { ...current };

    for (const [key, val] of Object.entries(increments)) {
      if (typeof val === "number" && typeof (updated as any)[key] === "number") {
        (updated as any)[key] += val;
      }
    }

    updated.lastActivationDate = new Date().toISOString();
    // Simple momentum calculation: completed micro tasks * current streak multiplier
    updated.currentStreak += 1;
    updated.momentumScore += (10 * updated.currentStreak);

    await dbAdmin.collection("userAnalytics").doc(userId).set(updated);
    return updated;
  }
}

export const activationService = new ActivationService();
