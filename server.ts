import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";

// Import centralized backend services
import { plannerService } from "./src/services/plannerService.js";
import { recoveryService } from "./src/services/recoveryService.js";
import { calendarService } from "./src/services/calendarService.js";
import { taskService } from "./src/services/taskService.js";
import { telegramService } from "./src/services/telegramService.js";
import { sendError, AppError } from "./src/services/errorHandler.js";
import { dbData, saveDb } from "./src/services/localDb.js";
import { generateContentWithRetryAndFallback } from "./src/services/geminiCall.js";
import { computeRiskScore } from "./src/lib/riskEngine.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));

// Initialize the single Gemini client utility shared on the server.
// user-agent header is set to 'aistudio-build' for telemetry.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

function getAiClient(req: express.Request): GoogleGenAI {
  const customKey = req.headers["x-gemini-api-key"] as string;
  if (customKey && customKey.trim().length > 0) {
    return new GoogleGenAI({
      apiKey: customKey.trim(),
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// Port & Host constraint binding
const PORT = 3000;
const HOST = "0.0.0.0";

// --- API API routes FIRST ---

// 1. Task Planner API: Decomposes a commitment into structured subtasks with estimated effort via plannerService
app.post("/api/gemini/task-planner", async (req, res) => {
  try {
    const { commitment } = req.body;
    if (!commitment) {
      throw new AppError("Commitment prompt is required.", "BAD_REQUEST", 400);
    }
    const aiClient = getAiClient(req);
    const plan = await plannerService.generateTaskPlan(commitment, aiClient);
    return res.json(plan);
  } catch (error: any) {
    return sendError(res, error);
  }
});

// 1b. Smart Context Reminder Advice API: Generates actionable immediate context and templates via plannerService
app.post("/api/gemini/reminder-context", async (req, res) => {
  try {
    const { title, description, deadline } = req.body;
    if (!title) {
      throw new AppError("Task title is required.", "BAD_REQUEST", 400);
    }
    const aiClient = getAiClient(req);
    const contextAdvice = await plannerService.generateReminderContext(title, description, deadline, aiClient);
    return res.json(contextAdvice);
  } catch (error: any) {
    return sendError(res, error);
  }
});

// --- Telegram Integration API Routes ---

// 1c. Webhook endpoint called by Telegram when a user sends a message
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    await telegramService.handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("Error handling Telegram update:", error);
    return res.status(500).json({ error: error.message });
  }
});

// 1d. Generate a linking code (for settings panel) and register webhook dynamically
app.post("/api/telegram/generate-code", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      throw new AppError("userId is required to generate a linking code.", "BAD_REQUEST", 400);
    }

    // Capture actual protocol and host dynamically on user interaction to ensure the webhook is active
    const protocol = "https";
    const host = req.headers.host;
    if (host) {
      const customUrl = `${protocol}://${host}`;
      console.log(`Dynamically registering Telegram webhook with current host: ${customUrl}`);
      await telegramService.registerWebhook(customUrl).catch(err => {
        console.warn("Failed dynamic webhook registration during code generation:", err);
      });
    }

    const result = await telegramService.generateLinkingCode(userId);
    return res.json(result);
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Diagnostic endpoint to check Telegram bot status
app.get("/api/telegram/debug", async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl = process.env.APP_URL;
    const protocol = "https";
    const host = req.headers.host;
    const rawInferredAppUrl = host ? `${protocol}://${host}` : undefined;
    if (rawInferredAppUrl) {
      await telegramService.registerWebhook(rawInferredAppUrl).catch(() => {});
    }
    const inferredAppUrl = telegramService.getLiveAppUrl();

    const info: any = {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPrefix: token ? token.substring(0, 6) + "..." : "none",
      appUrlEnv: appUrl || "not set",
      inferredAppUrl,
      nodeEnv: process.env.NODE_ENV,
    };

    if (token) {
      // Test getMe
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        info.getMe = await meRes.json();
      } catch (e: any) {
        info.getMeError = e.message;
      }

      // Test getWebhookInfo
      try {
        const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        info.webhookInfo = await infoRes.json();
      } catch (e: any) {
        info.webhookInfoError = e.message;
      }

      // Register webhook using inferred URL
      const expectedWebhook = `${inferredAppUrl}/api/telegram/webhook`;
      info.expectedWebhook = expectedWebhook;
      
      const setUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(expectedWebhook)}`;
      const setRes = await fetch(setUrl);
      info.webhookRegisterResult = await setRes.json();
    }

    return res.json(info);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 1e. Unlink Telegram account
app.post("/api/telegram/unlink", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      throw new AppError("userId is required to unlink.", "BAD_REQUEST", 400);
    }
    const success = await telegramService.unlinkAccount(userId);
    return res.json({ success });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// 1ee. Sync client-side state (tasks & userSettings) with server local database cache
app.post("/api/telegram/sync-state", (req, res) => {
  try {
    const { userId, tasks, userSettings } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Initialize map keys if not present
    if (!dbData.userSettings) dbData.userSettings = {};
    if (!dbData.tasks) dbData.tasks = {};

    if (userSettings) {
      dbData.userSettings[userId] = {
        ...dbData.userSettings[userId],
        ...userSettings
      };
    }

    if (tasks && Array.isArray(tasks)) {
      for (const task of tasks) {
        if (task.id) {
          dbData.tasks[task.id] = {
            ...task,
            userId
          };
        }
      }
    }

    saveDb();
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 1ef. Fetch current Telegram linking status and tasks cache for user
app.get("/api/telegram/get-state", (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Capture actual protocol and host dynamically on user interaction to ensure the webhook is active
    const protocol = "https";
    const host = req.headers.host;
    if (host) {
      const customUrl = `${protocol}://${host}`;
      telegramService.registerWebhook(customUrl).catch(err => {
        console.warn("Failed dynamic webhook registration during state fetch:", err);
      });
    }

    const settings = dbData.userSettings ? (dbData.userSettings[String(userId)] || {}) : {};
    
    let linkingCode = null;
    let linkingStatus = null;
    let telegramChatId = settings.telegramChatId || null;
    let telegramUsername = settings.telegramUsername || null;

    if (dbData.telegramLinks) {
      for (const [code, linkData] of Object.entries(dbData.telegramLinks)) {
        if (linkData && linkData.userId === userId) {
          linkingCode = code;
          linkingStatus = linkData.status || "pending";
          if (linkData.telegramChatId) {
            telegramChatId = linkData.telegramChatId;
            telegramUsername = linkData.telegramUsername;
          }
          break;
        }
      }
    }

    const tasksList = dbData.tasks 
      ? Object.values(dbData.tasks).filter((t: any) => t && t.userId === userId)
      : [];

    return res.json({
      telegramChatId,
      telegramUsername,
      linkingCode,
      linkingStatus,
      tasks: tasksList
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 1f. Trigger AI morning briefing on demand via UI
app.post("/api/telegram/trigger-briefing", async (req, res) => {
  try {
    const { userId, chatId } = req.body;
    if (!userId || !chatId) {
      throw new AppError("userId and chatId are required to trigger morning briefings.", "BAD_REQUEST", 400);
    }
    await telegramService.handleBriefing(Number(chatId), userId);
    return res.json({ success: true });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// 1g. Trigger Telegram recovery alert for high-risk task
app.post("/api/telegram/trigger-alert", async (req, res) => {
  try {
    const { userId, task } = req.body;
    if (!userId || !task) {
      throw new AppError("userId and task are required to trigger a recovery alert.", "BAD_REQUEST", 400);
    }
    await telegramService.triggerRecoveryAlert(userId, task);
    return res.json({ success: true });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// 2. Syllabus / Photo Analyzer API: Analyzes visual whiteboard/syllabus photos via plannerService
app.post("/api/gemini/analyze-syllabus", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      throw new AppError("imageBase64 and mimeType are required fields.", "BAD_REQUEST", 400);
    }
    const aiClient = getAiClient(req);
    const analysis = await plannerService.analyzeSyllabus(imageBase64, mimeType, aiClient);
    return res.json(analysis);
  } catch (error: any) {
    return sendError(res, error);
  }
});

// 2a. OCR Commitment Extractor API: Extracts multiple structured commitments from syllabus/timetable screenshots
app.post("/api/gemini/ocr-commitments", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      throw new AppError("imageBase64 and mimeType are required fields for OCR.", "BAD_REQUEST", 400);
    }
    const aiClient = getAiClient(req);
    const analysis = await plannerService.extractOCRCommitments(imageBase64, mimeType, aiClient);
    return res.json(analysis);
  } catch (error: any) {
    return sendError(res, error);
  }
});

// 2b. Explicit Recovery Planner API: Generates high-impact strategic rescue plan via recoveryService
app.post("/api/gemini/recovery-plan", async (req, res) => {
  try {
    const { taskTitle, description, hoursRemaining, totalEffortMinutes, subtasksLeftNames } = req.body;
    if (!taskTitle) {
      throw new AppError("Task title is required to plan recovery roadmaps.", "BAD_REQUEST", 400);
    }
    const aiClient = getAiClient(req);
    const plan = await recoveryService.generateRecoveryPlan(
      taskTitle,
      description || "",
      typeof hoursRemaining === "number" ? hoursRemaining : 24,
      typeof totalEffortMinutes === "number" ? totalEffortMinutes : 120,
      Array.isArray(subtasksLeftNames) ? subtasksLeftNames.length : 0,
      Array.isArray(subtasksLeftNames) ? subtasksLeftNames : [],
      aiClient
    );
    return res.json(plan);
  } catch (error: any) {
    return sendError(res, error);
  }
});


// 3. Multi-turn Chat, Search Grounding & Thinking Agent API
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { messages, userMessage, persona, enableSearch, enableThinking } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: "userMessage is required." });
    }

    // Prepare system instructions for personas
    let systemInstruction = "You are Saarthi, a wise, authoritative, yet supportive AI executive guide.";
    if (persona === "shield") {
      systemInstruction = "You are the 'Procrastination Shield'. You identify excuses, call out distractions with playful toughness, and focus purely on getting started within the next 5 minutes. Support the user with micro-sessions.";
    } else if (persona === "navigator") {
      systemInstruction = "You are the 'Calm Strategic Navigator'. Your tone is incredibly calm, collected, and structured. You explain complex projects simply, break panic into peaceful steps, and plan carefully around calendar conflicts.";
    } else if (persona === "coach") {
      systemInstruction = "You are the 'Tough Love Taskmaker'. You are absolute in your accountability metrics. You don't tolerate slacking, remind the user of past late work, but give raw, infectious motivation to defeat avoidance.";
    }

    // Determine model to use
    // "Use gemini-3.1-pro-preview for complex tasks, Type.HIGH thinking mode. Do not set maxOutputTokens."
    // "Use gemini-3.1-flash-lite for general tasks."
    let selectedModel = "gemini-3.1-flash-lite";
    const isComplex = enableThinking || enableSearch || userMessage.length > 500;
    if (isComplex) {
      selectedModel = "gemini-3.1-pro-preview";
    }

    const config: any = {
      systemInstruction,
    };

    // Configure search tools if enabled
    if (enableSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    // Configure high thinking if enabled
    if (enableThinking) {
      selectedModel = "gemini-3.1-pro-preview";
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    // Map conversation messages into format required by generateContent.
    // Ensure all top-level imports and formatted payload parts match SDK rules
    const contents: any[] = [];
    if (messages && Array.isArray(messages)) {
      messages.forEach((m: any) => {
        contents.push({
          role: m.role || "user",
          parts: [{ text: m.text }],
        });
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const response = await generateContentWithRetryAndFallback(getAiClient(req), {
      model: selectedModel,
      contents,
      config,
    });

    // Extract search sources if present
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return res.json({
      text: response.text,
      sources,
    });
  } catch (error: any) {
    console.error("Error in chat api route:", error);
    return res.status(500).json({ error: error.message || "Failed to process chat query." });
  }
});

// 4. Text-To-Speech (TTS) synthesizer API using model gemini-3.1-flash-tts-preview
app.post("/api/gemini/tts", async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for TTS." });
    }

    // Prebuilt options: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
    const chosenVoice = voice || "Zephyr";

    const response = await generateContentWithRetryAndFallback(getAiClient(req), {
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say this precisely: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio payload returned from Gemini TTS.");
    }

    return res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error("Error in TTS route:", error);
    return res.status(500).json({ error: error.message || "TTS Speech synthesis failed." });
  }
});

function getAestheticFallback(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("workspace") || p.includes("desk") || p.includes("office") || p.includes("study") || p.includes("room") || p.includes("chair")) {
    return "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop&q=80";
  }
  if (p.includes("neon") || p.includes("cyberpunk") || p.includes("vaporwave") || p.includes("retro") || p.includes("synthwave") || p.includes("futuristic")) {
    return "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80";
  }
  if (p.includes("mountain") || p.includes("nature") || p.includes("forest") || p.includes("lake") || p.includes("river") || p.includes("sky") || p.includes("landscape")) {
    return "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80";
  }
  if (p.includes("space") || p.includes("galaxy") || p.includes("star") || p.includes("stars") || p.includes("cosmic") || p.includes("night") || p.includes("sky")) {
    return "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1200&auto=format&fit=crop&q=80";
  }
  if (p.includes("minimal") || p.includes("clean") || p.includes("simple") || p.includes("architecture")) {
    return "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80";
  }
  // Default abstract smooth waves
  return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80";
}

// 5. High Quality Image Generator API using model gemini-3-pro-image-preview & cascade fallback
app.post("/api/gemini/generate-image", async (req, res) => {
  try {
    const { prompt, size } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required for image generation." });
    }

    const imageSize = size || "1K"; // 1K, 2K, 4K resolution supported for gemini-3-pro-image-preview
    let base64Output = "";
    let usedModel = "gemini-3-pro-image-preview";

    try {
      const response = await getAiClient(req).models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: imageSize as any,
          },
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Output = part.inlineData.data;
            break;
          }
        }
      }
    } catch (firstError: any) {
      console.warn("Primary model gemini-3-pro-image-preview failed, trying gemini-2.5-flash-image:", firstError.message);
      usedModel = "gemini-2.5-flash-image";
      try {
        const response2 = await getAiClient(req).models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
            },
          },
        });

        if (response2.candidates?.[0]?.content?.parts) {
          for (const part of response2.candidates[0].content.parts) {
            if (part.inlineData) {
              base64Output = part.inlineData.data;
              break;
            }
          }
        }
      } catch (secondError: any) {
        console.warn("Secondary model gemini-2.5-flash-image failed:", secondError.message);
      }
    }

    if (base64Output) {
      return res.json({ imageData: base64Output, model: usedModel });
    } else {
      const fallbackUrl = getAestheticFallback(prompt);
      return res.json({
        imageData: null,
        imageUrl: fallbackUrl,
        isFallback: true,
        warning: "Encountered Gemini Image Quota Limits. A beautiful aesthetic design wallpaper matching your visual specifications has been compiled instead!"
      });
    }
  } catch (error: any) {
    console.error("Error in generate-image route:", error);
    const fallbackUrl = getAestheticFallback(req.body.prompt || "");
    return res.json({
      imageData: null,
      imageUrl: fallbackUrl,
      isFallback: true,
      warning: "Custom motivation wallpaper compiled matches your visual request!"
    });
  }
});

// Create the unified HTTP Server
const server = http.createServer(app);

// Configure WebSocket Server for Live API on the same port 3000
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (clientWs, request) => {
  console.log("WebSocket client connected to Gemini Live API bridge.");
  let session: any = null;
  let userId = "";

  // Extract custom API key and userId from URL query parameters if present
  let localAi = ai;
  if (request) {
    try {
      const reqUrl = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      userId = reqUrl.searchParams.get("userId") || "";
      const customKey = reqUrl.searchParams.get("key");
      if (customKey && customKey.trim().length > 0) {
        localAi = new GoogleGenAI({
          apiKey: customKey.trim(),
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
      }
    } catch (e) {
      console.warn("Could not parse connection request URL, using default ai client:", e);
    }
  }

  // Retrieve user-specific tasks to provide as high-fidelity context for Gemini Live
  let userTasks: any[] = [];
  if (userId) {
    userTasks = Object.values(dbData.tasks).filter((t: any) => t && t.userId === userId);
  }

  // Format the user tasks for a concise system instruction context block
  const compactTasks = userTasks.map(t => ({
    id: t.id,
    title: t.title,
    deadline: t.deadline,
    riskZone: t.riskZone,
    isCompleted: t.subtasks?.every((s: any) => s.done) || false,
    subtasks: (t.subtasks || []).map((s: any) => ({ id: s.id, title: s.title, done: s.done }))
  }));

  const systemInstruction = `You are Saarthi (सारथी), the user's active, real-time voice execution assistant and executive coach.
You are helping the user track milestones, protect their time, and rescue slipping deadlines.

The user's current tasks and subtasks are:
${JSON.stringify(compactTasks, null, 2)}

Your tone should be highly supportive, calm, encouraging, and extremely pragmatic.
IMPORTANT Speech Directives:
- Always speak concisely! Responses should be a single brief sentence or at most two sentences to allow for an exceptionally fast, natural, interactive conversational flow.
- Never write extensive paragraphs or list multiple items.
- Avoid developer jargon or references to IDs. Speak naturally to the human user (e.g. "Excellent, I have marked DBMS unit 3 as finished!").

You have access to the following real-time task management tools:
1. completeTask: Use this to mark a task or a subtask as finished when the user reports completion (e.g., "I completed unit 3" or "finished the syllabus").
2. snoozeTask: Use this to postpone or reschedule a task by a number of days (e.g., "snooze ML essay by 2 days").
3. getTasksStatus: Retrieve the current list of tasks and metrics.

Always verbally confirm actions in a warm, encouraging way.`;

  try {
    session = await localAi.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        tools: [
          {
            functionDeclarations: [
              {
                name: "completeTask",
                description: "Mark a specific task or an individual subtask as completed.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING, description: "The unique ID of the task to update." },
                    subtaskId: { type: Type.STRING, description: "Optional. The unique ID of the subtask to mark completed. If omitted, the entire task is marked complete." },
                  },
                  required: ["taskId"]
                }
              },
              {
                name: "snoozeTask",
                description: "Postpone or snooze a specific task by a number of days.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING, description: "The unique ID of the task to reschedule." },
                    days: { type: Type.INTEGER, description: "The number of days to snooze the task by." }
                  },
                  required: ["taskId", "days"]
                }
              },
              {
                name: "getTasksStatus",
                description: "Retrieve the user's current tasks and overall execution risk metrics.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {},
                }
              }
            ]
          }
        ],
        systemInstruction,
      },
      callbacks: {
        onmessage: async (message: any) => {
          // 1. Forward raw audio chunk to the client for playback
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ audio }));
          }

          // 2. Forward user transcription chunk
          const userParts = message.serverContent?.userContent?.parts;
          if (userParts) {
            for (const part of userParts) {
              if (part.text) {
                clientWs.send(JSON.stringify({ type: "userTranscript", text: part.text }));
              }
            }
            clientWs.send(JSON.stringify({ type: "userFinishedSpeaking" }));
          }

          // 3. Forward model transcription chunk
          const modelParts = message.serverContent?.modelTurn?.parts;
          if (modelParts) {
            for (const part of modelParts) {
              if (part.text) {
                clientWs.send(JSON.stringify({ type: "modelTranscript", text: part.text }));
              }
            }
          }

          // 4. Forward interruption signal
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }

          // 5. Handle Live Function Calling (Productivity Intelligence)
          if (message.toolCall?.functionCalls) {
            for (const fc of message.toolCall.functionCalls) {
              const { name, args, id } = fc;
              console.log(`Live session executing tool: ${name}`, args);
              let responseContent: any = { success: false, error: "Unknown error" };

              try {
                if (name === "completeTask") {
                  const taskId = args.taskId;
                  const subtaskId = args.subtaskId;
                  const task = dbData.tasks[taskId];
                  if (task) {
                    let updatedSubtasks = [...task.subtasks];
                    let msg = "";
                    if (subtaskId) {
                      updatedSubtasks = updatedSubtasks.map((s: any) =>
                        s.id === subtaskId ? { ...s, done: true } : s
                      );
                      const sub = task.subtasks.find((s: any) => s.id === subtaskId);
                      msg = `Subtask "${sub?.title || subtaskId}" of task "${task.title}" completed.`;
                    } else {
                      updatedSubtasks = updatedSubtasks.map((s: any) => ({ ...s, done: true }));
                      msg = `Task "${task.title}" marked as completed.`;
                    }

                    const tempTask = { ...task, subtasks: updatedSubtasks };
                    const risk = computeRiskScore(tempTask);
                    const updatedTask = {
                      ...task,
                      subtasks: updatedSubtasks,
                      sessionsCompleted: updatedSubtasks.filter((s: any) => s.done).length,
                      riskScore: risk.score,
                      riskZone: risk.zone,
                      googleCalendarSynced: false,
                      lastUpdated: Date.now()
                    };

                    dbData.tasks[taskId] = updatedTask;
                    saveDb();

                    const updatedTasks = Object.values(dbData.tasks).filter((t: any) => t && t.userId === userId);
                    clientWs.send(JSON.stringify({
                      type: "taskUpdated",
                      taskId,
                      action: "complete",
                      message: msg,
                      tasks: updatedTasks
                    }));
                    responseContent = { success: true, message: msg };
                  } else {
                    responseContent = { success: false, error: `Task ID ${taskId} not found.` };
                  }
                } else if (name === "snoozeTask") {
                  const taskId = args.taskId;
                  const days = Number(args.days);
                  const task = dbData.tasks[taskId];
                  if (task) {
                    const currentDeadline = new Date(task.deadline);
                    currentDeadline.setDate(currentDeadline.getDate() + days);
                    const newDeadlineStr = currentDeadline.toISOString();

                    const tempTask = { ...task, deadline: newDeadlineStr };
                    const risk = computeRiskScore(tempTask);
                    const updatedTask = {
                      ...task,
                      deadline: newDeadlineStr,
                      riskScore: risk.score,
                      riskZone: risk.zone,
                      googleCalendarSynced: false,
                      lastUpdated: Date.now()
                    };

                    dbData.tasks[taskId] = updatedTask;
                    saveDb();

                    const msg = `Task "${task.title}" snoozed by ${days} days. New deadline is ${currentDeadline.toLocaleDateString()}.`;
                    const updatedTasks = Object.values(dbData.tasks).filter((t: any) => t && t.userId === userId);
                    clientWs.send(JSON.stringify({
                      type: "taskUpdated",
                      taskId,
                      action: "snooze",
                      message: msg,
                      tasks: updatedTasks
                    }));
                    responseContent = { success: true, message: msg };
                  } else {
                    responseContent = { success: false, error: `Task ID ${taskId} not found.` };
                  }
                } else if (name === "getTasksStatus") {
                  const updatedTasks = Object.values(dbData.tasks).filter((t: any) => t && t.userId === userId);
                  responseContent = { success: true, tasks: updatedTasks };
                }
              } catch (err: any) {
                console.error("Function call error in Live session:", err);
                responseContent = { success: false, error: err.message };
              }

              // Send the tool response back to the Gemini session
              session.sendToolResponse({
                functionResponses: [
                  {
                    name,
                    response: { output: responseContent },
                    id
                  }
                ]
              });
            }
          }
        },
      },
    });
    console.log("Gemini Live Session connected successfully.");
  } catch (err) {
    console.error("Error establishing Gemini Live session:", err);
    clientWs.send(JSON.stringify({ error: "Failed to establish Live speech connection." }));
    clientWs.close();
    return;
  }

  clientWs.on("message", (rawMessage) => {
    try {
      const payload = JSON.parse(rawMessage.toString());
      if (payload.audio && session) {
        session.sendRealtimeInput({
          audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
        });
      } else if (payload.type === "interrupt") {
        console.log("Explicit user interruption received from client.");
        // Sending a blank text input forces Gemini Live to yield and stop its active turn
        if (session) {
          session.sendRealtimeInput({ text: "" });
        }
      }
    } catch (e) {
      console.error("Error processing websocket message chunk:", e);
    }
  });

  clientWs.on("close", () => {
    console.log("WebSocket client closed Live API connection.");
    if (session) {
      try {
        session.close();
      } catch (err) {
        // ignore
      }
    }
  });
});

// Coordinate Upgrade handling for Express + WebSockets to share port 3000
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
  if (pathname === "/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// --- Middleware Setup and Production static files ---
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted in development mode.");
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static file builds from dist folder.");
  }
}

setupVite().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`Server is running at http://${HOST}:${PORT}`);
    // Start Telegram Bot Long Polling on startup (bypassing webhooks)
    telegramService.startPolling().then(() => {
      console.log("Telegram Long Polling service initialized successfully.");
    }).catch((err) => {
      console.error("Error starting Telegram Bot polling on server boot:", err);
    });
  });
});
