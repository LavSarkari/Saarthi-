import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { extractAndParseJson } from "./jsonUtils.js";
import { AppError } from "./errorHandler.js";

export interface RecoveryPlan {
  isRecovered: boolean;
  situationSummary: string;
  messageToUser: string;
  advice: string;
}

export class RecoveryService {
  /**
   * Generates a compressed emergency execution recovery roadmap for threatened tasks.
   */
  async generateRecoveryPlan(
    taskTitle: string,
    description: string,
    hoursRemaining: number,
    totalEffortMinutes: number,
    subtasksLeftCount: number,
    subtasksLeftNames: string[],
    aiClient: GoogleGenAI
  ): Promise<RecoveryPlan> {
    if (!taskTitle || taskTitle.trim().length === 0) {
      throw new AppError("Task title is required to generate a recovery plan.", "BAD_REQUEST", 400);
    }

    const defaultFallback: RecoveryPlan = {
      isRecovered: false,
      situationSummary: "Task execution rate is currently falling behind standard milestones relative to target deadline.",
      messageToUser: "Focus only on immediate items: De-scope low priority targets and start a 15-minute execution block right now.",
      advice: "Operational compromise: Complete only the absolute core subtasks first. Skip optional polishing and ask for peer review early.",
    };

    try {
      const prompt = `Task Title: "${taskTitle}"
Description: "${description || "None"}"
Hours Remaining to Deadline: ${hoursRemaining.toFixed(1)}h
Total Effort Planned: ${totalEffortMinutes} minutes
Number of Subtasks Left: ${subtasksLeftCount}
Pending Subtasks: [${subtasksLeftNames.join(", ")}]

Generate a concentrated, realistic emergency recovery roadmap immediately. Be direct, authoritative, yet supportive. Provide specific compromises and actionable compromises of scope that the user can do to salvage this deadline, focused strictly on what is achievable in the remaining time.`;

      // Use gemini-3.1-pro-preview with high thinking for strategic advice
      const response = await aiClient.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are Saarthi, a high-level productivity strategist expert. You analyze threatened deadlines and compile high-impact, tight, operational compromise strategies that allow users to complete their minimum viable commitment before the buzzer. Format your advice with very concise bullet items.",
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isRecovered: { type: Type.BOOLEAN, description: "Whether recovery has successfully initiated." },
              situationSummary: { type: Type.STRING, description: "Brief objective diagnosis of why this execution is under pressure." },
              messageToUser: { type: Type.STRING, description: "Empathetic but strict direct motivational command to unlock action right away." },
              advice: { type: Type.STRING, description: "Targeted operational compromises, descaling options and tactical tips." },
            },
            required: ["isRecovered", "situationSummary", "messageToUser", "advice"],
          },
        },
      });

      const parsed = extractAndParseJson<RecoveryPlan>(response.text || "", defaultFallback);

      return {
        isRecovered: typeof parsed.isRecovered === "boolean" ? parsed.isRecovered : false,
        situationSummary: (typeof parsed.situationSummary === "string" && parsed.situationSummary.trim()) ? parsed.situationSummary.trim() : defaultFallback.situationSummary,
        messageToUser: (typeof parsed.messageToUser === "string" && parsed.messageToUser.trim()) ? parsed.messageToUser.trim() : defaultFallback.messageToUser,
        advice: (typeof parsed.advice === "string" && parsed.advice.trim()) ? parsed.advice.trim() : defaultFallback.advice,
      };
    } catch (error) {
      console.error("RecoveryService.generateRecoveryPlan failed", error);
      return defaultFallback;
    }
  }
}

export const recoveryService = new RecoveryService();
