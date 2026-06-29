import { mockFirestore as dbAdmin } from "./localDb";
import { UserEngagement, BehaviourState, NotificationLog } from "../types";
import { computeRiskScore } from "../lib/riskEngine";

import { evaluateCompanionAdaptation } from "../lib/companionEngine";

export class EngagementService {

  public async getEngagement(userId: string): Promise<UserEngagement> {
    const docRef = dbAdmin.collection("userEngagement").doc(userId);
    const snap = await docRef.get();
    
    if (snap.exists) {
      const data = snap.data() as UserEngagement;
      // Perform automated time-based decay of the score if necessary
      return await this.applyTimeBasedDecay(userId, data);
    }

    // Default engagement state
    const defaultEngage: UserEngagement = {
      userId,
      engagementScore: 60,
      behaviourState: "building_momentum",
      engagementHistory: [{ timestamp: new Date().toISOString(), score: 60 }],
      notificationHistory: [],
      notificationAcceptanceRate: 100,
      averageResponseDelaySeconds: 30,
      quietHours: {
        enabled: true,
        start: "22:00",
        end: "08:00"
      },
      burnoutSignals: [],
      focusConsistency: 70,
      consecutiveIgnoredCount: 0,
      lastInteractionTime: new Date().toISOString()
    };
    await docRef.set(defaultEngage);
    return defaultEngage;
  }

  private async applyTimeBasedDecay(userId: string, data: UserEngagement): Promise<UserEngagement> {
    if (!data.lastInteractionTime) return data;
    const lastTime = new Date(data.lastInteractionTime).getTime();
    const hoursElapsed = (new Date().getTime() - lastTime) / (1000 * 60 * 60);

    if (hoursElapsed > 24) {
      // Decay score by 5 points for each 24h of inactivity, floor at 15
      const decayAmount = Math.floor(hoursElapsed / 24) * 8;
      const originalScore = data.engagementScore;
      data.engagementScore = Math.max(15, data.engagementScore - decayAmount);
      data.lastInteractionTime = new Date().toISOString(); // prevent double decay
      
      if (originalScore !== data.engagementScore) {
        data.engagementHistory.push({
          timestamp: new Date().toISOString(),
          score: data.engagementScore
        });
        if (data.engagementHistory.length > 30) data.engagementHistory.shift();
        
        // Recalculate state
        data.behaviourState = await this.classifyState(userId, data);
        await dbAdmin.collection("userEngagement").doc(userId).set(data);
        await this.adaptCompanion(userId, data);
      }
    }
    return data;
  }

  /**
   * Main entrypoint when user interacts with Saarthi (web or Telegram).
   * Automatically raises score, records timestamp, and reclassifies state.
   */
  public async recordInteraction(userId: string, type: "message" | "button_press" | "focus_session_start" | "micro_task_complete"): Promise<UserEngagement> {
    const eng = await this.getEngagement(userId);
    let scoreBump = 0;

    if (type === "message") scoreBump = 5;
    else if (type === "button_press") scoreBump = 4;
    else if (type === "focus_session_start") scoreBump = 10;
    else if (type === "micro_task_complete") scoreBump = 15;

    eng.engagementScore = Math.min(100, eng.engagementScore + scoreBump);
    eng.consecutiveIgnoredCount = 0; // reset back-off on any real interaction
    eng.nextAllowedNotificationTime = undefined; // clear lock
    eng.lastInteractionTime = new Date().toISOString();

    eng.engagementHistory.push({
      timestamp: new Date().toISOString(),
      score: eng.engagementScore
    });
    if (eng.engagementHistory.length > 30) eng.engagementHistory.shift();

    // Recalculate state
    eng.behaviourState = await this.classifyState(userId, eng);
    await dbAdmin.collection("userEngagement").doc(userId).set(eng);
    await this.adaptCompanion(userId, eng);
    return eng;
  }

  /**
   * Classify user's behavioral state based on deterministic signals.
   */
  public async classifyState(userId: string, eng: UserEngagement): Promise<BehaviourState> {
    // 1. Check for Deadline Crisis (any task is critical)
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const hasCriticalTask = tasksSnap.docs.some(d => {
        const risk = computeRiskScore(d.data() as any);
        return risk.zone === "critical";
      });
      if (hasCriticalTask) return "deadline_crisis";
    } catch (e) {
      console.error("Error checking critical tasks in classifyState:", e);
    }

    // 2. Check for Burned Out state (high consecutive sessions, or explicitly registered burnout signals)
    if (eng.burnoutSignals.length >= 3) {
      return "burned_out";
    }

    // 3. Score-based state boundaries
    if (eng.engagementScore >= 85) return "highly_engaged";
    if (eng.engagementScore >= 55) return "building_momentum";
    if (eng.engagementScore < 30) return "overwhelmed";
    
    // Otherwise passive
    return "passive";
  }

  /**
   * Log notification dispatch and adjust back-off delays based on user responsiveness.
   */
  public async logNotification(userId: string, type: string): Promise<UserEngagement> {
    const eng = await this.getEngagement(userId);
    const newLog: NotificationLog = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      type,
      status: "sent"
    };

    eng.notificationHistory.push(newLog);
    if (eng.notificationHistory.length > 50) eng.notificationHistory.shift();

    await dbAdmin.collection("userEngagement").doc(userId).set(eng);
    return eng;
  }

  /**
   * Marks a sent notification as "engaged" (responded to)
   */
  public async recordNotificationEngagement(userId: string, notificationId: string): Promise<UserEngagement> {
    const eng = await this.getEngagement(userId);
    const log = eng.notificationHistory.find(l => l.id === notificationId);
    
    if (log) {
      log.status = "engaged";
      log.engagedAt = new Date().toISOString();
      
      // Compute response delay
      const sentTime = new Date(log.timestamp).getTime();
      const delay = (new Date().getTime() - sentTime) / 1000;
      eng.averageResponseDelaySeconds = Math.round(
        (eng.averageResponseDelaySeconds * 4 + delay) / 5
      );
    }

    eng.consecutiveIgnoredCount = 0;
    eng.nextAllowedNotificationTime = undefined;
    eng.engagementScore = Math.min(100, eng.engagementScore + 3);

    // Recalculate metrics
    this.recalculateAcceptanceRate(eng);
    await dbAdmin.collection("userEngagement").doc(userId).set(eng);
    await this.adaptCompanion(userId, eng);
    return eng;
  }

  private async adaptCompanion(userId: string, eng: UserEngagement): Promise<void> {
    try {
      const userSettingsRef = dbAdmin.collection("userSettings").doc(userId);
      const userSettingsSnap = await userSettingsRef.get();
      if (!userSettingsSnap.exists) return;
      
      const userSettings = userSettingsSnap.data() as any;
      if (!userSettings.companionProfile) return;

      const profile = userSettings.companionProfile;
      const updates = evaluateCompanionAdaptation(eng, profile);
      
      if (updates) {
        const newProfile = { ...profile, ...updates };
        await userSettingsRef.update({ companionProfile: newProfile });
      }
    } catch (e) {
      console.error("Failed to adapt companion in EngagementService:", e);
    }
  }

  /**
   * Logs an ignored notification, advancing back-off tier
   */
  public async recordNotificationIgnored(userId: string, notificationId: string): Promise<UserEngagement> {
    const eng = await this.getEngagement(userId);
    const log = eng.notificationHistory.find(l => l.id === notificationId);
    
    if (log) {
      log.status = "ignored";
    }

    eng.consecutiveIgnoredCount += 1;
    eng.engagementScore = Math.max(0, eng.engagementScore - 10);

    // Calculate Back-off rules:
    // T1 (ignored 1-2): lock next notifications for 2 hours
    // T2 (ignored 3): lock next notifications for 6 hours
    // T3 (ignored 4+): lock until evening reflection / 12 hours
    let lockHours = 0;
    if (eng.consecutiveIgnoredCount === 1) lockHours = 1;
    else if (eng.consecutiveIgnoredCount === 2) lockHours = 2;
    else if (eng.consecutiveIgnoredCount === 3) lockHours = 6;
    else lockHours = 12;

    const lockUntil = new Date();
    lockUntil.setHours(lockUntil.getHours() + lockHours);
    eng.nextAllowedNotificationTime = lockUntil.toISOString();

    this.recalculateAcceptanceRate(eng);
    eng.behaviourState = await this.classifyState(userId, eng);
    await dbAdmin.collection("userEngagement").doc(userId).set(eng);
    await this.adaptCompanion(userId, eng);
    return eng;
  }

  private recalculateAcceptanceRate(eng: UserEngagement) {
    const relevantLogs = eng.notificationHistory.filter(l => l.status !== "sent");
    if (relevantLogs.length === 0) {
      eng.notificationAcceptanceRate = 100;
      return;
    }
    const engaged = relevantLogs.filter(l => l.status === "engaged").length;
    eng.notificationAcceptanceRate = Math.round((engaged / relevantLogs.length) * 100);
  }

  /**
   * Checks whether the current time is inside the user's quiet hours or busy blocks.
   */
  public isQuietHour(eng: UserEngagement): boolean {
    if (!eng.quietHours.enabled) return false;

    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const start = eng.quietHours.start;
    const end = eng.quietHours.end;

    if (start < end) {
      // e.g. "09:00" to "17:00"
      return currentHourMin >= start && currentHourMin <= end;
    } else {
      // e.g. "22:00" to "08:00" (crosses midnight)
      return currentHourMin >= start || currentHourMin <= end;
    }
  }

  public async registerBurnoutSignal(userId: string): Promise<UserEngagement> {
    const eng = await this.getEngagement(userId);
    eng.burnoutSignals.push(new Date().toISOString());
    // Only keep last 5 burnout signals
    if (eng.burnoutSignals.length > 5) eng.burnoutSignals.shift();
    eng.behaviourState = await this.classifyState(userId, eng);
    await dbAdmin.collection("userEngagement").doc(userId).set(eng);
    return eng;
  }

  public async saveQuietHours(userId: string, start: string, end: string, enabled: boolean): Promise<UserEngagement> {
    const eng = await this.getEngagement(userId);
    eng.quietHours = { enabled, start, end };
    await dbAdmin.collection("userEngagement").doc(userId).set(eng);
    return eng;
  }

  /**
   * Dynamically generates an emotionally intelligent daily briefing using Gemini 3.5-flash.
   * Matches the user's current behavioral state to calibrate pressure, vocabulary, and action density.
   */
  public async generateBriefing(userId: string, type: "morning" | "evening", aiClient: any): Promise<string> {
    const eng = await this.getEngagement(userId);
    
    // Fetch all active tasks
    let tasks: any[] = [];
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      tasks = tasksSnap.docs.map(d => d.data());
    } catch (e) {
      console.error("Error fetching tasks for briefing:", e);
    }

    // Format a high-level overview of tasks
    const tasksSummary = tasks.map(t => {
      const risk = computeRiskScore(t);
      return `- [${t.status || "pending"}] ${t.title} | Deadline: ${t.deadline || "None"} | Risk Score: ${risk.score} (${risk.zone})`;
    }).join("\n");

    const stateEmoji = {
      highly_engaged: "🔥 Highly Engaged",
      building_momentum: "📈 Building Momentum",
      passive: "😐 Passive Interaction",
      overwhelmed: "🌧 Overwhelmed",
      burned_out: "😴 Burned Out",
      deadline_crisis: "🚨 Deadline Crisis"
    }[eng.behaviourState] || "😐 Balanced Flow";

    let prompt = "";
    if (type === "morning") {
      prompt = `
You are Saarthi, an exceptionally empathetic, emotionally intelligent, and clear-thinking execution companion. Your sole objective is to guide the user gently into action, matching their psychological state perfectly.

User's current state: ${stateEmoji}
User's engagement score: ${eng.engagementScore}/100

Here is the current status of the user's active commitments:
${tasksSummary || "No tasks listed currently."}

Please generate a personalized, beautiful **Morning Briefing** for the user.
Follow these requirements closely:
1. **Greeting & Calibrated Tone**: Speak to the user like a human friend who understands their state. 
   - If they are in "Burned Out" or "Overwhelmed" mode, speak with extremely low pressure, warm encouragement, and suggest doing *nearly nothing* or resting.
   - If in "Deadline Crisis" or "Highly Engaged", provide high clarity, zero fluff, and precise, crisp priorities.
2. **Priorities**: Identify 1-2 most important items to touch today.
3. **Confidence & Workload Assessment**: Realistically assess how confident they should feel based on deadline proximity and risk scores.
4. **Biggest Risk**: Highlight the highest-risk commitment without sounding alarmist or guilty.
5. **Sugggested First Action**: Name a single, ultra-specific micro-step that takes less than 2 minutes to complete (e.g. "Open the document and write just the title", "Message Sarah with a simple 'hey'"). This eliminates activation friction.

Write the briefing beautifully formatted in Markdown. Do not include meta-text, introductions, or pleasantries about being an AI. Start directly with the briefing content. Use elegant formatting.
`;
    } else {
      prompt = `
You are Saarthi, an exceptionally empathetic, emotionally intelligent, and clear-thinking execution companion. Your sole objective is to guide the user gently into action, matching their psychological state perfectly.

User's current state: ${stateEmoji}
User's engagement score: ${eng.engagementScore}/100

Here is the current status of the user's active commitments:
${tasksSummary || "No tasks listed currently."}

Please generate a personalized, beautiful **Evening Reflection** for the user.
Follow these requirements closely:
1. **Reflection & Validation**: Praise whatever efforts they made today, even if small. If they are in "Burned Out" mode, validate their rest as a vital part of productive cycles.
2. **Completed / Momentum Summary**: Briefly summarize progress.
3. **Recovery Guidelines**: Suggest specific, non-screen relaxation or recovery activities matched to their state (e.g. walking, stretching, reading a physical book).
4. **Tomorrow's Primary Focal Point**: Identify a singular, clear starting point for tomorrow so they can sleep with a clear mind, free of cognitive residue.

Write the briefing beautifully formatted in Markdown. Do not include meta-text, introductions, or pleasantries about being an AI. Start directly with the reflection content. Use elegant formatting.
`;
    }

    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      return response.text || "Failed to generate briefing. Please try again.";
    } catch (err: any) {
      console.error("Gemini briefing generation failed:", err);
      return `### Saarthi Companion Update\n\nI was unable to connect to our guidance engine right now. However, I want to remind you: you are doing great, and taking things one tiny step at a time is the best path forward. Let's touch base soon!`;
    }
  }
}

export const engagementService = new EngagementService();
