import { GoogleGenAI, Type, Schema } from "@google/genai";
import { extractAndParseJson } from "./jsonUtils.js";
import { AppError } from "./errorHandler.js";
import { generateContentWithRetryAndFallback } from "./geminiCall.js";
import { mockFirestore as dbAdmin } from "./localDb.js";
import { Task, AIRecoveryPlan, RecoveryMode } from "../types.js";
import { computeRiskScore } from "../lib/riskEngine.js";

export class RecoveryService {
  /**
   * Generates a full AI Recovery Plan based on the user's current situation.
   */
  async generateRecoveryPlan(userId: string, mode: RecoveryMode, aiClient: GoogleGenAI): Promise<AIRecoveryPlan> {
    const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
    let tasks: Task[] = tasksSnap.docs.map(d => d.data() as Task);

    const now = new Date().getTime();
    
    // Sort tasks by risk and deadline
    tasks = tasks.sort((a, b) => {
      const aRisk = computeRiskScore(a).score;
      const bRisk = computeRiskScore(b).score;
      if (aRisk !== bRisk) return bRisk - aRisk; // Higher risk first
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const activeTasks = tasks.filter(t => {
      const allDone = t.subtasks.length > 0 && t.subtasks.every(s => s.done);
      return !allDone;
    });

    const totalEffort = activeTasks.reduce((acc, t) => acc + t.totalEffortMinutes, 0);

    const summaryData = activeTasks.map(t => ({
      id: t.id,
      title: t.title,
      deadline: t.deadline,
      effortMinutes: t.totalEffortMinutes,
      priority: t.priority,
      risk: computeRiskScore(t).zone
    }));

    // High level context for AI
    let modeInstruction = "";
    switch (mode) {
      case "minimal":
        modeInstruction = "Minimal Survival mode: Strip everything down to the absolute bare minimum to survive the week. Sacrifice everything non-essential.";
        break;
      case "balanced":
        modeInstruction = "Balanced Recovery mode: Find a realistic path to recover without burning out. Delay some things, compress others.";
        break;
      case "maximum":
        modeInstruction = "Maximum Performance mode: The user is willing to sprint. Push deadlines slightly, compress scope heavily, but try to salvage as much as possible.";
        break;
      case "wellness":
        modeInstruction = "Wellness First mode: The user is severely burned out or sick. Cancel and move everything that can possibly be moved to next week.";
        break;
    }

    const prompt = `User's active commitments:
${JSON.stringify(summaryData, null, 2)}

Total Effort Remaining: ${totalEffort} minutes.
Recovery Strategy: ${modeInstruction}

You are Saarthi's AI Recovery OS. The user has fallen behind and is overwhelmed. 
Build a comprehensive, empathetic recovery plan. The 'message' should be extremely warm, calming, non-judgmental, and validating. It should start with a purple heart 💜 or similar gentle emoji. (e.g. "💜 Looks like life became more complicated than expected. That's okay. Let's rebuild your week together.")

Select 'criticalCommitments' (IDs that must stay) and 'flexibleCommitments' (IDs that can move).
Provide 'suggestedTradeoffs' using specific 'proposedAction' types (reduce_scope, delay, split, skip, compress).
Provide 'newWeeklyPlan' specifying exactly what to keep, move, or modify, along with realistic new deadlines in ISO format.
Estimate the 'expectedRecovery' metrics.
`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        situationSummary: {
          type: Type.OBJECT,
          properties: {
            whatHappened: { type: Type.STRING },
            why: { type: Type.STRING },
            message: { type: Type.STRING }
          },
          required: ["whatHappened", "why", "message"]
        },
        criticalCommitments: { type: Type.ARRAY, items: { type: Type.STRING } },
        flexibleCommitments: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestedTradeoffs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              taskId: { type: Type.STRING },
              originalTitle: { type: Type.STRING },
              proposedAction: { type: Type.STRING }, // "reduce_scope" | "delay" | "split" | "skip" | "compress"
              explanation: { type: Type.STRING },
              newDeadline: { type: Type.STRING },
              newTitle: { type: Type.STRING },
              effortSavedMinutes: { type: Type.INTEGER }
            },
            required: ["taskId", "originalTitle", "proposedAction", "explanation", "effortSavedMinutes"]
          }
        },
        newWeeklyPlan: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              taskId: { type: Type.STRING },
              title: { type: Type.STRING },
              newDeadline: { type: Type.STRING },
              priority: { type: Type.STRING },
              action: { type: Type.STRING }, // "keep" | "move" | "modify"
              notes: { type: Type.STRING }
            },
            required: ["taskId", "title", "newDeadline", "priority", "action"]
          }
        },
        expectedRecovery: {
          type: Type.OBJECT,
          properties: {
            confidenceBefore: { type: Type.INTEGER },
            confidenceAfter: { type: Type.INTEGER },
            timeRecoveredHours: { type: Type.INTEGER },
            stressReductionEstimate: { type: Type.STRING } // "low" | "medium" | "high"
          },
          required: ["confidenceBefore", "confidenceAfter", "timeRecoveredHours", "stressReductionEstimate"]
        }
      },
      required: ["situationSummary", "criticalCommitments", "flexibleCommitments", "suggestedTradeoffs", "newWeeklyPlan", "expectedRecovery"]
    };

    try {
      const response = await generateContentWithRetryAndFallback(aiClient, {
        model: "gemini-3.1-pro-preview", // Use pro for strategic planning
        contents: prompt,
        config: {
          systemInstruction: "You are the AI Recovery OS within Saarthi. Your job is to rescue users who are overwhelmed or failing their schedules. Rebuild their reality with deep empathy, tactical precision, and a zero-blame attitude.",
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const parsed = extractAndParseJson<any>(response.text || "", null);
      if (!parsed) throw new Error("Failed to parse Gemini response for Recovery Plan.");

      const plan: AIRecoveryPlan = {
        id: Math.random().toString(36).substring(2, 11),
        userId,
        createdAt: new Date().toISOString(),
        mode,
        situationSummary: parsed.situationSummary,
        criticalCommitments: parsed.criticalCommitments,
        flexibleCommitments: parsed.flexibleCommitments,
        suggestedTradeoffs: parsed.suggestedTradeoffs,
        newWeeklyPlan: parsed.newWeeklyPlan,
        expectedRecovery: parsed.expectedRecovery,
        status: "proposed"
      };

      // Save the proposed plan to firestore
      await dbAdmin.collection("recoveryPlans").doc(plan.id).set(plan);

      return plan;
    } catch (error: any) {
      console.error("Failed to generate Recovery Plan:", error);
      throw new AppError("Unable to build recovery plan right now.", "INTERNAL_SERVER_ERROR", 500);
    }
  }

  /**
   * Executes a recovery plan. Updates tasks in Firestore directly.
   */
  async executeRecoveryPlan(userId: string, planId: string): Promise<void> {
    const planRef = dbAdmin.collection("recoveryPlans").doc(planId);
    const planSnap = await planRef.get();
    if (!planSnap.exists) {
      throw new AppError("Recovery plan not found.", "NOT_FOUND", 404);
    }
    
    const plan = planSnap.data() as AIRecoveryPlan;
    if (plan.status !== "proposed") {
      throw new AppError("This plan has already been processed.", "BAD_REQUEST", 400);
    }

    // Apply the changes to the user's tasks
    for (const rebuilt of plan.newWeeklyPlan) {
      if (rebuilt.action === "keep") continue;

      const taskRef = dbAdmin.collection("tasks").doc(rebuilt.taskId);
      const taskSnap = await taskRef.get();
      if (!taskSnap.exists) continue;

      const task = taskSnap.data() as Task;
      
      let newTotalEffort = task.totalEffortMinutes;
      // Adjust effort if there's a tradeoff for this task
      const tradeoff = plan.suggestedTradeoffs.find(t => t.taskId === rebuilt.taskId);
      if (tradeoff) {
        newTotalEffort = Math.max(10, task.totalEffortMinutes - tradeoff.effortSavedMinutes);
      }

      await taskRef.update({
        deadline: rebuilt.newDeadline || task.deadline,
        priority: rebuilt.priority || task.priority,
        totalEffortMinutes: newTotalEffort,
        // Add a note about the recovery
        notes: task.notes ? `${task.notes}\n\n[Recovered: ${rebuilt.notes || tradeoff?.explanation || "Adjusted during recovery session"}]` : `[Recovered: ${rebuilt.notes || tradeoff?.explanation || "Adjusted during recovery session"}]`
      });
    }

    // Mark plan as accepted
    await planRef.update({ status: "accepted" });

    // In a real implementation, we would also:
    // - Call EngagementEngine to register a massive positive interaction
    // - Call CalendarService to reschedule blocks
  }
}

export const recoveryService = new RecoveryService();
