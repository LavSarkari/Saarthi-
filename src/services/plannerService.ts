import { GoogleGenAI, Type } from "@google/genai";
import { extractAndParseJson } from "./jsonUtils.js";
import { AppError } from "./errorHandler.js";
import { generateContentWithRetryAndFallback } from "./geminiCall.js";
import { Task } from "../types.js";

export interface SubtaskPlan {
  title: string;
  estimatedMinutes: number;
  order: number;
}

export interface TaskPlan {
  title: string;
  complexity: "low" | "medium" | "high";
  totalEffortMinutes: number;
  subtasks: SubtaskPlan[];
  riskFactors: string[];
}

export interface ReminderContext {
  nextLogicalStep: string;
  contextualAdvice: string;
  resourceSearchQueries: string[];
  draftTemplate: string;
}

export interface SyllabusAnalysis {
  extractedText: string;
  approximateDeadline: string;
  confidence: "High" | "Medium" | "Low";
}

export interface ExtractedCommitment {
  title: string;
  deadline: string; // YYYY-MM-DDTHH:mm format
  description: string;
  estimatedMinutes: number;
  confidence: number; // 0 to 100
}

export interface OCRResponse {
  commitments: ExtractedCommitment[];
  overallConfidence: number; // 0 to 100
}

export class PlannerService {
  /**
   * Decomposes any qualitative commitment prompt into a structured, action-oriented plan of subtasks.
   */
  async generateTaskPlan(commitment: string, aiClient: GoogleGenAI, aiContext?: string): Promise<TaskPlan> {
    if (!commitment || commitment.trim().length === 0) {
      throw new AppError("Commitment is empty. Cannot plan task.", "BAD_REQUEST", 400);
    }

    const defaultFallback: TaskPlan = {
      title: commitment.substring(0, 50) || "Actionable Commitment",
      complexity: "medium",
      totalEffortMinutes: 120,
      subtasks: [
        { title: "Define project core requirements", estimatedMinutes: 45, order: 1 },
        { title: "Outline main execution milestones", estimatedMinutes: 45, order: 2 },
        { title: "Perform final review & wrap-up", estimatedMinutes: 30, order: 3 },
      ],
      riskFactors: ["Lack of clear starting milestones", "Over-estimating left remaining timeline"],
    };

    try {
      let instructions = "You are Saarthi, a highly strategic task planner. Decompose the user's task or academic/professional commitment into clear, action-oriented, distinct subtasks. Underestimate nothing: be realistic and time-box each subtask. Suggest 3 to 6 subtasks. Return the response strictly as a JSON object that matches the provided schema.";
      if (aiContext) {
         instructions += `\n\nUSER BEHAVIORAL INTELLIGENCE CONTEXT:\n${aiContext}\nUse this context to adjust your time estimates, chunk sizes, and risk factors appropriately based on the user's historical performance.`;
      }
      const response = await generateContentWithRetryAndFallback(aiClient, {
        model: "gemini-3.1-flash-lite",
        contents: commitment,
        config: {
          systemInstruction: instructions,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A highly clear, polished visual title for the overall commitment.",
              },
              complexity: {
                type: Type.STRING,
                enum: ["low", "medium", "high"],
                description: "Complexity classification of this commitment",
              },
              totalEffortMinutes: {
                type: Type.INTEGER,
                description: "Sum of estimated minutes of all the subtasks.",
              },
              subtasks: {
                type: Type.ARRAY,
                description: "The sequence of subtasks needed to complete this commitment on calendar.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: "Explicit action-oriented title of the subtask (e.g., 'Outline Chapter 1', 'Refactor database auth').",
                    },
                    estimatedMinutes: {
                      type: Type.INTEGER,
                      description: "Realistic number of minutes required for this subtask (between 15 and 240).",
                    },
                    order: {
                      type: Type.INTEGER,
                      description: "Sequential index starting from 1.",
                    },
                  },
                  required: ["title", "estimatedMinutes", "order"],
                },
              },
              riskFactors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "A few bullet points identifying pitfalls that usually cause procrastination on this specific type of task.",
              },
            },
            required: ["title", "complexity", "totalEffortMinutes", "subtasks", "riskFactors"],
          },
        },
      });

      const parsed = extractAndParseJson<TaskPlan>(response.text || "", defaultFallback);

      // Validate schema values strictly to ensure complete immunity
      const finalTitle = (typeof parsed.title === "string" && parsed.title.trim()) ? parsed.title.trim() : defaultFallback.title;
      const finalComplexity = ["low", "medium", "high"].includes(parsed.complexity) ? parsed.complexity : "medium";
      const validatedSubtasks: SubtaskPlan[] = Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0 
        ? parsed.subtasks.map((s: any, i: number) => ({
            title: (typeof s.title === "string" && s.title.trim()) ? s.title.trim() : `Milestone ${i + 1}`,
            estimatedMinutes: (typeof s.estimatedMinutes === "number" && s.estimatedMinutes > 0) ? s.estimatedMinutes : 45,
            order: (typeof s.order === "number") ? s.order : i + 1,
          }))
        : defaultFallback.subtasks;

      const calculatedEffort = validatedSubtasks.reduce((sum, sub) => sum + sub.estimatedMinutes, 0);
      const finalTotalEffort = typeof parsed.totalEffortMinutes === "number" && parsed.totalEffortMinutes > 0
        ? parsed.totalEffortMinutes
        : calculatedEffort;

      const finalRiskFactors = Array.isArray(parsed.riskFactors)
        ? parsed.riskFactors.map(rf => typeof rf === "string" ? rf : "Potential distraction risks")
        : defaultFallback.riskFactors;

      return {
        title: finalTitle,
        complexity: finalComplexity,
        totalEffortMinutes: finalTotalEffort,
        subtasks: validatedSubtasks,
        riskFactors: finalRiskFactors,
      };
    } catch (error) {
      console.error("PlannerService.generateTaskPlan failed", error);
      return defaultFallback;
    }
  }

  async generateAdaptiveSchedule(
    userId: string,
    tasks: Task[],
    strategy: string,
    maxFocusDuration: number,
    preferredStartHour: number,
    preferredEndHour: number,
    aiClient: GoogleGenAI
  ): Promise<{ updatedTasks: Task[], insights: string[] }> {
    // If no tasks, nothing to schedule
    if (!tasks || tasks.length === 0) return { updatedTasks: [], insights: [] };

    const activeTasks = tasks.filter(t => t.subtasks.some(s => !s.done));
    if (activeTasks.length === 0) return { updatedTasks: tasks, insights: [] };

    // Format input for AI
    const tasksInput = activeTasks.map(t => ({
      id: t.id,
      title: t.title,
      deadline: t.deadline,
      subtasks: t.subtasks.filter(s => !s.done).map(s => ({
        id: s.id,
        title: s.title,
        estimatedMinutes: s.estimatedMinutes
      }))
    }));

    try {
      const prompt = `You are Saarthi's Adaptive Scheduling Engine.
Your goal is to take a list of active tasks and their pending subtasks, and dynamically assign them 'scheduledStart' and 'scheduledEnd' ISO dates based on the user's constraints.
Also, if a subtask's estimated time exceeds the max focus duration (${maxFocusDuration} mins), split it into multiple smaller subtasks!

Constraints:
- Strategy: ${strategy} (optimize the schedule for this strategy)
- Preferred Hours: ${preferredStartHour}:00 to ${preferredEndHour}:00
- Max Focus Duration per block: ${maxFocusDuration} minutes
- Start scheduling from: ${new Date().toISOString()}

Tasks Input:
${JSON.stringify(tasksInput, null, 2)}

Return a strict JSON object matching this schema:
{
  "updatedTasks": [
    {
      "id": "task-id",
      "subtasks": [
        {
          "id": "subtask-id (keep original if not split, or create new id if split)",
          "title": "Subtask title",
          "estimatedMinutes": 30,
          "scheduledStart": "ISO string",
          "scheduledEnd": "ISO string",
          "adaptiveExplanation": "Short string explaining why it was placed here or split"
        }
      ]
    }
  ],
  "insights": ["Insight 1", "Insight 2"]
}
`;

      const response = await generateContentWithRetryAndFallback(aiClient, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "You are an intelligent adaptive scheduling engine. Follow constraints strictly and return only JSON matching the schema.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              updatedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    subtasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          title: { type: Type.STRING },
                          estimatedMinutes: { type: Type.INTEGER },
                          scheduledStart: { type: Type.STRING },
                          scheduledEnd: { type: Type.STRING },
                          adaptiveExplanation: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              },
              insights: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      });

      let parsed;
      try {
        parsed = JSON.parse(response || "{}");
      } catch (e) {
        throw new Error("Failed to parse adaptive schedule response");
      }

      if (!parsed.updatedTasks) throw new Error("Invalid response schema");

      // Merge scheduled updates back into the original tasks
      const mergedTasks = tasks.map(t => {
        const update = parsed.updatedTasks.find((u: any) => u.id === t.id);
        if (update) {
          // preserve done subtasks
          const doneSubtasks = t.subtasks.filter(s => s.done);
          // map updated active subtasks
          const newActiveSubtasks = update.subtasks.map((us: any, idx: number) => ({
            id: us.id || `split_${Date.now()}_${idx}`,
            title: us.title,
            estimatedMinutes: us.estimatedMinutes,
            done: false,
            order: idx,
            scheduledStart: us.scheduledStart,
            scheduledEnd: us.scheduledEnd,
            adaptiveExplanation: us.adaptiveExplanation
          }));
          return { ...t, subtasks: [...doneSubtasks, ...newActiveSubtasks] };
        }
        return t;
      });

      return { updatedTasks: mergedTasks, insights: parsed.insights || [] };
    } catch (e) {
      console.error("Adaptive scheduling failed", e);
      return { updatedTasks: tasks, insights: ["Schedule fallback used due to optimization error."] };
    }
  }

  /**
   * Generates actionable immediate context suggestions, search topics, and template guidelines.
   */
  async generateReminderContext(
    title: string,
    description: string,
    deadline: string,
    aiClient: GoogleGenAI
  ): Promise<ReminderContext> {
    if (!title || title.trim().length === 0) {
      throw new AppError("Task title is required to generate context advice.", "BAD_REQUEST", 400);
    }

    const defaultFallback: ReminderContext = {
      nextLogicalStep: "Break the ice: Open your notepad and draft three bullet points about requirements.",
      contextualAdvice: "Set up a clean, distraction-free environment. Turn off notifications and set a timer for 15 minutes of quiet focus.",
      resourceSearchQueries: [
        `${title} outline template doc`,
        `${title} beginner starter guide`,
        `avoiding procrastination on ${title}`
      ],
      draftTemplate: `# Draft Plan for ${title}\n- [ ] Focus Item 1\n- [ ] Prep Session`,
    };

    try {
      const prompt = `Task Title: "${title}"\nTask Description: "${description || "None"}"\nTarget Deadline: "${deadline || "None"}"`;

      const response = await generateContentWithRetryAndFallback(aiClient, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: `You are Saarthi, an expert productivity strategist. Analyze the user's upcoming task and generate precise, highly contextual, actionable execution details that go far beyond a standard passive reminder.
Depending on the task type, provide:
1. nextLogicalStep: A single, extremely concrete, immediate action-oriented step to overcome starting friction.
2. contextualAdvice: A supportive, strategic guidance note explaining potential avoidance blocks and how to setup your environment for optimal completion.
3. resourceSearchQueries: Array of 3 highly optimized and precise Search Queries to find references, formulas, tools, or templates on Google.
4. draftTemplate: A complete copy-pasteable starter draft, structured markdown template, meeting agenda, email draft, or checklist suited specifically to the task so they can start typing right away.

Return the response strictly as a JSON object matching the provided schema.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nextLogicalStep: { type: Type.STRING, description: "Extremely actionable, clear immediate next step." },
              contextualAdvice: { type: Type.STRING, description: "Coaching words of wisdom on starting hurdles and setup advice." },
              resourceSearchQueries: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly three search query strings that lead directly to guides or materials.",
              },
              draftTemplate: { type: Type.STRING, description: "Fully formed copyable markdown starter template." },
            },
            required: ["nextLogicalStep", "contextualAdvice", "resourceSearchQueries", "draftTemplate"],
          },
        },
      });

      const parsed = extractAndParseJson<ReminderContext>(response.text || "", defaultFallback);

      return {
        nextLogicalStep: (typeof parsed.nextLogicalStep === "string" && parsed.nextLogicalStep.trim()) ? parsed.nextLogicalStep.trim() : defaultFallback.nextLogicalStep,
        contextualAdvice: (typeof parsed.contextualAdvice === "string" && parsed.contextualAdvice.trim()) ? parsed.contextualAdvice.trim() : defaultFallback.contextualAdvice,
        resourceSearchQueries: Array.isArray(parsed.resourceSearchQueries) && parsed.resourceSearchQueries.length > 0
          ? parsed.resourceSearchQueries.map(q => typeof q === "string" ? q : "productivity guide")
          : defaultFallback.resourceSearchQueries,
        draftTemplate: (typeof parsed.draftTemplate === "string" && parsed.draftTemplate.trim()) ? parsed.draftTemplate.trim() : defaultFallback.draftTemplate,
      };
    } catch (error) {
      console.error("PlannerService.generateReminderContext failed", error);
      return defaultFallback;
    }
  }

  /**
   * Analyzes an uploaded image (whiteboard, syllabus photo, project board) and extracts commitments.
   */
  async analyzeSyllabus(imageBase64: string, mimeType: string, aiClient: GoogleGenAI): Promise<SyllabusAnalysis> {
    if (!imageBase64 || !mimeType) {
      throw new AppError("Base64 image data and mimeType are required for syllabus analysis.", "BAD_REQUEST", 400);
    }

    const defaultFallback: SyllabusAnalysis = {
      extractedText: "Review captured whiteboard commitments and outline milestones.",
      approximateDeadline: "Friday afternoon",
      confidence: "Medium",
    };

    try {
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      };

      const textPart = {
        text: "Examine the uploaded photo (e.g. syllabus, project board, whiteboard snapshot, planner entry). Identify and extract the main upcoming assignment, exam, task, deadline or commitment text in detail. Estimate standard effort parameters and list what it is. Return as a clean JSON object schema.",
      };

      const response = await generateContentWithRetryAndFallback(aiClient, {
        model: "gemini-3.1-pro-preview",
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedText: { type: Type.STRING, description: "A synthesized natural language statement of the extracted commitment." },
              approximateDeadline: { type: Type.STRING, description: "Approximate estimated deadline if found." },
              confidence: { type: Type.STRING, enum: ["High", "Medium", "Low"], description: "Visual extraction confidence." },
            },
            required: ["extractedText", "approximateDeadline", "confidence"],
          },
        },
      });

      const parsed = extractAndParseJson<SyllabusAnalysis>(response.text || "", defaultFallback);

      return {
        extractedText: (typeof parsed.extractedText === "string" && parsed.extractedText.trim()) ? parsed.extractedText : defaultFallback.extractedText,
        approximateDeadline: (typeof parsed.approximateDeadline === "string" && parsed.approximateDeadline.trim()) ? parsed.approximateDeadline : defaultFallback.approximateDeadline,
        confidence: ["High", "Medium", "Low"].includes(parsed.confidence) ? parsed.confidence : "Medium",
      };
    } catch (error) {
      console.error("PlannerService.analyzeSyllabus failed", error);
      return defaultFallback;
    }
  }

  /**
   * Performs high-accuracy OCR extraction of academic and professional commitments from images.
   * Leverages Gemini Vision to extract title, deadline, description, estimated effort, and confidence.
   */
  async extractOCRCommitments(imageBase64: string, mimeType: string, aiClient: GoogleGenAI): Promise<OCRResponse> {
    if (!imageBase64 || !mimeType) {
      throw new AppError("Base64 image data and mimeType are required for OCR commitment extraction.", "BAD_REQUEST", 400);
    }

    const defaultFallback: OCRResponse = {
      commitments: [],
      overallConfidence: 0
    };

    try {
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      };

      // Current system date for relative calculations is 2026-06-23
      const textPart = {
        text: `You are Saarthi's advanced OCR Vision engine. Read this syllabus, assignment description, exam schedule, or timetable screenshot.
Extract ALL commitments, assignments, exams, and key task deadlines.
For each extracted commitment, determine:
1. Title: Crisp, descriptive name of the commitment.
2. Deadline: Formatted as YYYY-MM-DDTHH:mm. Today is June 23, 2026 (2026-06-23). If the document says 'Friday' or 'due in 3 days', calculate the exact date based on today's date. If no deadline is listed, pick a reasonable upcoming date (e.g. next Friday or end of month) and document it.
3. Description: Key details, rubrics, chapters covered, or requirements found in the text.
4. Estimated Effort: Your best estimate of effort required in total minutes (e.g. 60, 120, 300).
5. Confidence: Extrapolated percentage from 0 to 100 based on text legibility and directness.

Return your response strictly in the JSON schema provided.`,
      };

      const response = await generateContentWithRetryAndFallback(aiClient, {
        model: "gemini-3.1-flash-lite",
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              commitments: {
                type: Type.ARRAY,
                description: "List of all commitments extracted from the image.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Crisp specific title of the commitment." },
                    deadline: { type: Type.STRING, description: "ISO 8601 local format (YYYY-MM-DDTHH:mm)." },
                    description: { type: Type.STRING, description: "Summary of description, requirements, or syllabus context." },
                    estimatedMinutes: { type: Type.INTEGER, description: "Total recommended/estimated minutes for execution." },
                    confidence: { type: Type.INTEGER, description: "Confidence score out of 100." }
                  },
                  required: ["title", "deadline", "description", "estimatedMinutes", "confidence"]
                }
              },
              overallConfidence: { type: Type.INTEGER, description: "Overall confidence of OCR processing out of 100." }
            },
            required: ["commitments", "overallConfidence"]
          }
        }
      });

      const parsed = extractAndParseJson<OCRResponse>(response.text || "", defaultFallback);

      // Clean up and validate extracted dates so they always match datetime-local format YYYY-MM-DDTHH:mm
      const validatedCommitments = (parsed.commitments || []).map((c: any) => {
        let deadline = c.deadline || "";
        // Basic check if deadline matches YYYY-MM-DDTHH:mm or similar
        const dateMatch = deadline.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
        if (!dateMatch) {
          // If unparsable or empty, generate an upcoming default deadline (e.g., Friday of this week)
          // June 23, 2026 is Tuesday, so Friday is June 26, 2026
          deadline = "2026-06-26T17:00";
        } else {
          deadline = dateMatch[0]; // grab the clean match
        }

        return {
          title: typeof c.title === "string" && c.title.trim() ? c.title.trim() : "Extracted Commitment",
          deadline: deadline,
          description: typeof c.description === "string" && c.description.trim() ? c.description.trim() : "No details extracted.",
          estimatedMinutes: typeof c.estimatedMinutes === "number" && c.estimatedMinutes > 0 ? c.estimatedMinutes : 120,
          confidence: typeof c.confidence === "number" ? Math.max(0, Math.min(100, c.confidence)) : 80
        };
      });

      return {
        commitments: validatedCommitments,
        overallConfidence: typeof parsed.overallConfidence === "number" ? Math.max(0, Math.min(100, parsed.overallConfidence)) : 80
      };
    } catch (error) {
      console.error("PlannerService.extractOCRCommitments failed", error);
      return defaultFallback;
    }
  }
}

export const plannerService = new PlannerService();
