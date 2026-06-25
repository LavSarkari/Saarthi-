import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Calendar,
  CheckSquare,
  Volume2,
  Image as ImageIcon,
  Mic,
  MicOff,
  User as UserIcon,
  HelpCircle,
  Clock,
  AlertTriangle,
  Upload,
  Search,
  Check,
  TrendingUp,
  Brain,
  ChevronDown,
  LogOut,
  RefreshCw,
  Plus,
  Play,
  FileText,
  Settings,
  Trash2,
  X,
  ExternalLink,
  Sun,
  Moon
} from "lucide-react";
import { User } from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  setDoc
} from "firebase/firestore";
import {
  initAuth,
  googleSignIn,
  logout as authLogout,
  getAccessToken,
  db
} from "./lib/firebase";
import { Task, ChatMessage, Subtask, OCRExtractedCommitment } from "./types";
import { computeRiskScore, getHoursRemaining } from "./lib/riskEngine";
import { calendarService } from "./services/calendarService";
import LandingPage from "./components/LandingPage";
import TaskCard from "./components/TaskCard";
import SettingsModal from "./components/SettingsModal";
import SyllabusAnalyzer from "./components/SyllabusAnalyzer";
import OCRReviewModal from "./components/OCRReviewModal";
import AssistantPanel from "./components/AssistantPanel";

const SYSTEM_ADMIN_EMAILS = [
  "luv.sarkari@gmail.com",
  "admin@saarthi-platform.com",
  "sandbox_sim_luv_sarkari_gmail_com",
  "sandbox@saarthi-platform.com"
];

async function parseApiError(res: Response, defaultMessage: string): Promise<string> {
  let errMessage = defaultMessage;
  try {
    const errData = await res.json();
    if (errData.error) {
      errMessage = errData.error;
    }
  } catch (_) {}

  const lowerErr = errMessage.toLowerCase();
  if (lowerErr.includes("503") || lowerErr.includes("unavailable") || lowerErr.includes("demand")) {
    return "AI is currently experiencing high demand and is unavailable. Please wait a moment and try again.";
  } else if (lowerErr.includes("429") || lowerErr.includes("quota") || lowerErr.includes("exhausted")) {
    return "API quota exceeded. Please try again later.";
  }
  
  // Try to parse nested JSON if it exists
  try {
    const nested = JSON.parse(errMessage);
    if (nested && nested.error && nested.error.message) {
      errMessage = nested.error.message;
    }
  } catch (_) {}
  
  return errMessage;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentView, setCurrentView] = useState<"landing" | "workspace" | "tasks">("landing");

  // Task list states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newCommitment, setNewCommitment] = useState("");
  const [customDeadline, setCustomDeadline] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);

  // Chat interface states
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPersona, setChatPersona] = useState<"shield" | "navigator" | "coach">("navigator");
  const [enableGrounding, setEnableGrounding] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatSources, setChatSources] = useState<any[]>([]);

  // Syllabus parsing state
  const [analyzerFile, setAnalyzerFile] = useState<File | null>(null);
  const [analyzerPreview, setAnalyzerPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedResult, setAnalyzedResult] = useState<string | null>(null);

  // OCR Workflow States
  const [extractedCommitments, setExtractedCommitments] = useState<OCRExtractedCommitment[]>([]);
  const [ocrOverallConfidence, setOcrOverallConfidence] = useState<number>(0);
  const [isOcrReviewOpen, setIsOcrReviewOpen] = useState<boolean>(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);

  // TTS status and voice choices
  const [ttsVoice, setTtsVoice] = useState<string>("Zephyr");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Image Generation settings
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);

  // Live WebSocket state
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveLog, setLiveLog] = useState<string>("Disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // Local notification toasts
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Active assistant tab
  const [activeTab, setActiveTab] = useState<"chat" | "voice" | "poster" | "help">("chat");

  // Track expanded task subtasks view
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Track expanded task reminder details
  const [expandedReminderTaskId, setExpandedReminderTaskId] = useState<string | null>(null);

  // Track loading status for reminder contexts
  const [generatingContextTaskId, setGeneratingContextTaskId] = useState<string | null>(null);

  // User Custom API Key settings
  const [userApiKey, setUserApiKey] = useState<string>("");
  const [settingsKeyInput, setSettingsKeyInput] = useState<string>("");
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Telegram states
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramCodeExpires, setTelegramCodeExpires] = useState<string | null>(null);
  const [isGeneratingTelegramCode, setIsGeneratingTelegramCode] = useState<boolean>(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"api" | "telegram">("api");

  // High-contrast theme toggling state and synchronization
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
    }
    return "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Sandbox-Safe alternative auth states for iframes/popups bypass
  const [showSandboxForm, setShowSandboxForm] = useState<boolean>(false);
  const [sandboxEmail, setSandboxEmail] = useState<string>("");
  const [sandboxName, setSandboxName] = useState<string>("");
  const [loginErrorHint, setLoginErrorHint] = useState<string | null>(null);

  // Show Toast helper
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Initialize Auth state
  useEffect(() => {
    // Check for simulated sandbox user session first
    const storedSimulated = localStorage.getItem("saarthi_current_simulated_user");
    if (storedSimulated) {
      try {
        const parsed = JSON.parse(storedSimulated);
        setUser(parsed);
        setNeedsAuth(false);
        triggerToast(`Welcome back, ${parsed.displayName || "Warrior"} (Sandbox Mode)!`);
        return;
      } catch (e) {
        console.warn("Could not parse stored simulated user:", e);
      }
    }

    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
        triggerToast(`Welcome back, ${currentUser.displayName || "Warrior"}!`);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Scroll to top on view/auth transitions
  useEffect(() => {
    if (currentView === "workspace" && !needsAuth) {
      window.scrollTo(0, 0);
    }
  }, [currentView, needsAuth]);

  // Sync / write tasks to local storage
  const saveLocalTasks = (uid: string, newTasks: Task[]) => {
    localStorage.setItem("saarthi_local_tasks_" + uid, JSON.stringify(newTasks));
  };

  // Fetch or Subscribe to Firestore tasks for current authenticated user
  useEffect(() => {
    if (!user) return;

    if (user.isSimulated) {
      // Direct fast load from local storage
      const localTasksStr = localStorage.getItem("saarthi_local_tasks_" + user.uid);
      if (localTasksStr) {
        try {
          const parsed = JSON.parse(localTasksStr);
          const processed = parsed.map((t: Task) => {
            const risk = computeRiskScore(t);
            return {
              ...t,
              riskScore: risk.score,
              riskZone: risk.zone,
            };
          });
          processed.sort((a: Task, b: Task) => {
            if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          });
          setTasks(processed);
        } catch (e) {
          console.error("Failed to parse local simulated tasks:", e);
        }
      } else {
        setTasks([]);
      }
      return;
    }

    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbTasks: Task[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        // Compute real-time risk scores on live data
        const tempTask = {
          id: doc.id,
          userId: d.userId,
          title: d.title || "Untitled commitment",
          description: d.description || "",
          complexity: d.complexity || "medium",
          totalEffortMinutes: d.totalEffortMinutes || 120,
          deadline: d.deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
          subtasks: (d.subtasks || []) as Subtask[],
          sessionsCompleted: d.sessionsCompleted || 0,
          sessionsPlanned: d.sessionsPlanned || 0,
          riskFactors: d.riskFactors || [],
          createdAt: d.createdAt || new Date().toISOString(),
          googleCalendarSynced: !!d.googleCalendarSynced,
          googleTasksSynced: !!d.googleTasksSynced,
          recoveryPlan: d.recoveryPlan,
          reminderContext: d.reminderContext,
        };
        const risk = computeRiskScore(tempTask);
        dbTasks.push({
          ...tempTask,
          riskScore: risk.score,
          riskZone: risk.zone,
          reminderContext: tempTask.reminderContext,
        });
      });
      // Sort tasks putting critical risk first
      dbTasks.sort((a, b) => {
        if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
      setTasks(dbTasks);
      saveLocalTasks(user.uid, dbTasks);
    }, (error) => {
      console.warn("Firestore subscription failed. Falling back to local tasks:", error);
      const localTasksStr = localStorage.getItem("saarthi_local_tasks_" + user.uid);
      if (localTasksStr) {
        try {
          const parsed = JSON.parse(localTasksStr);
          const processed = parsed.map((t: Task) => {
            const risk = computeRiskScore(t);
            return {
              ...t,
              riskScore: risk.score,
              riskZone: risk.zone,
            };
          });
          processed.sort((a: Task, b: Task) => {
            if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          });
          setTasks(processed);
        } catch (e) {
          console.error("Failed to parse local tasks fallback:", e);
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Load and subscribe to User Settings (custom API Key) on login from Firestore and localStorage
  useEffect(() => {
    if (!user) {
      setUserApiKey("");
      setSettingsKeyInput("");
      return;
    }

    // Fast load from local storage
    const storedLocalKey = localStorage.getItem("saarthi_gemini_api_key_" + user.uid);
    if (storedLocalKey) {
      setUserApiKey(storedLocalKey);
      setSettingsKeyInput(storedLocalKey);
    }

    // Skip Firestore listener if simulated
    if (user.isSimulated) {
      return;
    }

    // Subscribe to Firestore settings
    const qDoc = doc(db, "userSettings", user.uid);
    const unsubscribe = onSnapshot(qDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          if (data.geminiApiKey) {
            const key = data.geminiApiKey;
            setUserApiKey(key);
            setSettingsKeyInput(key);
            localStorage.setItem("saarthi_gemini_api_key_" + user.uid, key);
          }
          if (data.telegramChatId) {
            setTelegramChatId(data.telegramChatId);
          } else {
            setTelegramChatId(null);
          }
          if (data.telegramUsername) {
            setTelegramUsername(data.telegramUsername);
          } else {
            setTelegramUsername(null);
          }
        }
      }
    }, (error) => {
      console.warn("Could not read user settings from Firestore:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Monitor tasks and dispatch real-time Telegram alerts when a task transitions to critical risk
  const prevZonesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!user || user.isSimulated || tasks.length === 0) return;

    tasks.forEach((task) => {
      const prevZone = prevZonesRef.current[task.id];
      const nextZone = task.riskZone;

      // Transition to critical!
      if (prevZone && prevZone !== "critical" && nextZone === "critical") {
        fetch("/api/telegram/trigger-alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.uid, task }),
        }).catch((err) => console.warn("Failed to dispatch Telegram recovery alert:", err));
      }

      // Track the current zone
      prevZonesRef.current[task.id] = nextZone;
    });
  }, [tasks, user]);

  // Synchronize client-side tasks and settings to the server's local Telegram cache
  useEffect(() => {
    if (!user) return;

    const syncWithServerCache = async () => {
      try {
        await fetch("/api/telegram/sync-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            tasks,
            userSettings: {
              telegramChatId,
              telegramUsername,
              geminiApiKey: userApiKey
            }
          })
        });
      } catch (e) {
        console.warn("Could not sync state to server cache:", e);
      }
    };

    // Debounce state synchronization slightly to avoid slamming the server on typing
    const timer = setTimeout(syncWithServerCache, 2000);
    return () => clearTimeout(timer);
  }, [user, tasks, telegramChatId, telegramUsername, userApiKey]);

  // Poll server state periodically to detect linking success or task changes from Telegram Bot
  useEffect(() => {
    if (!user) return;

    const pollServerState = async () => {
      try {
        const res = await fetch(`/api/telegram/get-state?userId=${encodeURIComponent(user.uid)}`);
        if (res.ok) {
          const data = await res.json();
          
          // 1. Check if Telegram has been linked
          if (data.telegramChatId && data.telegramChatId !== telegramChatId) {
            setTelegramChatId(data.telegramChatId);
            if (data.telegramUsername) {
              setTelegramUsername(data.telegramUsername);
            }
            triggerToast("Telegram account linked successfully!");

            // If real user (not simulated), write the linked details to Firestore too
            if (!user.isSimulated) {
              const docRef = doc(db, "userSettings", user.uid);
              await setDoc(docRef, {
                telegramChatId: data.telegramChatId,
                telegramUsername: data.telegramUsername || "",
                telegramLinkedAt: new Date().toISOString()
              }, { merge: true }).catch(err => 
                console.warn("Failed to write userSettings back to Firestore:", err)
              );
            }
          }

          // 2. Merge any tasks updated by the Telegram Bot
          if (data.tasks && data.tasks.length > 0) {
            setTasks((prevTasks) => {
              let changed = false;
              const merged = prevTasks.map((prevTask) => {
                const serverTask = data.tasks.find((t: any) => t.id === prevTask.id);
                if (serverTask) {
                  const subtasksDiff = JSON.stringify(prevTask.subtasks) !== JSON.stringify(serverTask.subtasks);
                  const completedDiff = prevTask.sessionsCompleted !== serverTask.sessionsCompleted;
                  if (subtasksDiff || completedDiff) {
                    changed = true;
                    // Write back to Firestore if not simulated
                    if (!user.isSimulated) {
                      const docRef = doc(db, "tasks", prevTask.id);
                      setDoc(docRef, serverTask, { merge: true }).catch(err => 
                        console.warn("Failed to update task back to Firestore:", err)
                      );
                    } else {
                      // Update simulated tasks in local storage
                      const localTasksKey = "saarthi_local_tasks_" + user.uid;
                      const stored = localStorage.getItem(localTasksKey);
                      if (stored) {
                        try {
                          const parsed = JSON.parse(stored) as Task[];
                          const updatedParsed = parsed.map(pt => pt.id === prevTask.id ? { ...pt, ...serverTask } : pt);
                          localStorage.setItem(localTasksKey, JSON.stringify(updatedParsed));
                        } catch (e) {
                          console.warn("Error updating local storage task:", e);
                        }
                      }
                    }
                    return { ...prevTask, ...serverTask };
                  }
                }
                return prevTask;
              });
              return changed ? merged : prevTasks;
            });
          }
        }
      } catch (e) {
        console.warn("Error polling Telegram state:", e);
      }
    };

    const interval = setInterval(pollServerState, 3000);
    return () => clearInterval(interval);
  }, [user, telegramChatId, telegramUsername]);

  // Handle saving API key setting to Firestore and LocalStorage
  const handleSaveSettings = async () => {
    if (!user) return;
    try {
      const trimmedKey = settingsKeyInput.trim();
      
      setUserApiKey(trimmedKey);
      localStorage.setItem("saarthi_gemini_api_key_" + user.uid, trimmedKey);

      if (!user.isSimulated) {
        const docRef = doc(db, "userSettings", user.uid);
        await setDoc(docRef, {
          geminiApiKey: trimmedKey,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      setShowSettingsModal(false);
      triggerToast("Settings saved successfully! Custom API Key is live.");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      triggerToast(`Fails to save settings: ${err.message}`);
    }
  };

  // Handle generating a 6-digit linking code for Telegram Bot
  const handleGenerateLinkCode = async () => {
    if (!user) return;
    setIsGeneratingTelegramCode(true);
    try {
      const res = await fetch("/api/telegram/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.code) {
        setTelegramCode(data.code);
        setTelegramCodeExpires(data.expiresAt);
        triggerToast("Linking code generated successfully!");
      } else {
        triggerToast("Failed to generate code.");
      }
    } catch (e: any) {
      triggerToast("Failed to generate code: " + e.message);
    } finally {
      setIsGeneratingTelegramCode(false);
    }
  };

  // Handle unlinking Telegram account from user settings
  const handleUnlinkTelegram = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/telegram/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramChatId(null);
        setTelegramUsername(null);
        setTelegramCode(null);
        setTelegramCodeExpires(null);
        triggerToast("Telegram connection unlinked successfully.");
      } else {
        triggerToast("Failed to unlink Telegram.");
      }
    } catch (e: any) {
      triggerToast("Failed to unlink Telegram: " + e.message);
    }
  };

  // Handle sending an on-demand morning briefing to Telegram chat
  const handleTriggerBriefing = async () => {
    if (!user || !telegramChatId) return;
    triggerToast("Requesting Telegram AI execution briefing...");
    try {
      const res = await fetch("/api/telegram/trigger-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, chatId: telegramChatId }),
      });
      const data = await res.json();
      if (data.success) {
        triggerToast("Morning briefing dispatched to Telegram!");
      } else {
        triggerToast("Briefing dispatch failed.");
      }
    } catch (e: any) {
      triggerToast("Failed to dispatch briefing: " + e.message);
    }
  };

  // Google Login flow trigger
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginErrorHint(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setLoginErrorHint(err.message || String(err));
      setShowSandboxForm(true);
      triggerToast(`Authentication error: ${err.message || err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("saarthi_current_simulated_user");
    await authLogout();
    setUser(null);
    setAccessToken(null);
    setTasks([]);
    setChats([]);
    triggerToast("Signed out successfully.");
  };

  // Safe Mode sandbox simulation access login
  const handleSandboxLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxEmail.trim()) {
      triggerToast("Please enter an email address.");
      return;
    }
    const nameToUse = sandboxName.trim() || "Saarthi Warrior";
    const simUserObj = {
      uid: "sandbox_sim_" + sandboxEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"),
      email: sandboxEmail.trim().toLowerCase(),
      displayName: nameToUse,
      photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      isSimulated: true
    };
    
    setUser(simUserObj as any);
    localStorage.setItem("saarthi_current_simulated_user", JSON.stringify(simUserObj));
    setNeedsAuth(false);
    triggerToast(`Welcome to Sandbox Workspace, ${nameToUse}!`);
  };

  // Pre-configured custom headers with the API Key for server-side Gemini requests
  const getApiHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (userApiKey) {
      headers["x-gemini-api-key"] = userApiKey;
    }
    return headers;
  };

  // Submit commitment text trigger - Calls backend /api/gemini/task-planner
  const handleAddCommitment = async (textOverload?: string, deadlineOverload?: string, titleOverload?: string) => {
    if (isPlanning) return; // Prevent duplicate concurrent planning operations and duplicate records

    const targetText = textOverload || newCommitment;
    if (!targetText.trim()) return;

    setIsPlanning(true);
    triggerToast("Saarthi is strategically framing your execution blueprint...");

    try {
      // Setup a dynamic target deadline
      let deadlineIso = "";
      const targetDeadline = deadlineOverload || customDeadline;
      if (targetDeadline) {
        deadlineIso = new Date(targetDeadline).toISOString();
      } else {
        // Fallback to Friday or 3 days out
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 3);
        deadlineIso = defaultDate.toISOString();
      }

      const response = await fetch("/api/gemini/task-planner", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ commitment: targetText }),
      });

      if (!response.ok) {
        const errorMsg = await parseApiError(response, "Failed to reach Saarthi task decomposition model.");
        throw new Error(errorMsg);
      }

      const generatedData = await response.json();

      // Ensure task and subtasks remain perfectly synchronized & validated
      const subtaskArray: Subtask[] = (generatedData.subtasks || []).map((s: any, idx: number) => ({
        id: `sub_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        title: (s.title && s.title.trim()) ? s.title.trim() : `Milestone Task ${idx + 1}`,
        estimatedMinutes: s.estimatedMinutes || 45,
        done: false,
        order: s.order || idx + 1,
      }));

      if (subtaskArray.length === 0) {
        subtaskArray.push({
          id: `sub_${Date.now()}_0`,
          title: "Setup and initial commitment requirements mapping",
          estimatedMinutes: 45,
          done: false,
          order: 1,
        });
      }

      const syncedTotalMinutes = subtaskArray.reduce((sum, s) => sum + s.estimatedMinutes, 0);

      const newTaskObj = {
        userId: user!.uid,
        title: titleOverload || ((generatedData.title && generatedData.title.trim()) ? generatedData.title.trim() : targetText),
        description: targetText,
        complexity: generatedData.complexity || "medium",
        totalEffortMinutes: syncedTotalMinutes,
        deadline: deadlineIso,
        subtasks: subtaskArray,
        sessionsPlanned: subtaskArray.length,
        sessionsCompleted: 0,
        riskFactors: generatedData.riskFactors || [],
        createdAt: new Date().toISOString(),
        googleCalendarSynced: false,
        googleTasksSynced: false,
      };

      if (user!.isSimulated) {
        const id = "local_task_" + Date.now();
        const localTasks = [...tasks, { ...newTaskObj, id, riskScore: 0, riskZone: "safe" as const }];
        setTasks(localTasks);
        saveLocalTasks(user!.uid, localTasks);
      } else {
        try {
          await addDoc(collection(db, "tasks"), newTaskObj);
        } catch (dbErr: any) {
          console.warn("Firestore addDoc failed, using local storage fallback:", dbErr);
          const id = "local_task_" + Date.now();
          const localTasks = [...tasks, { ...newTaskObj, id, riskScore: 0, riskZone: "safe" as const }];
          setTasks(localTasks);
          saveLocalTasks(user!.uid, localTasks);
        }
      }

      setNewCommitment("");
      setCustomDeadline("");
      triggerToast("Commitment established. Subtasks mapped & scheduled.");
    } catch (err: any) {
      console.error(err);
      triggerToast(`Decomposition error: ${err.message}`);
    } finally {
      setIsPlanning(false);
    }
  };


  // Syllabus analyser file selection
  const handleSyllabusFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAnalyzerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAnalyzerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Triggers backend image analyzer using gemini-3.1-pro-preview
  const handleAnalyzeSyllabus = async () => {
    if (!analyzerPreview) return;
    setIsAnalyzing(true);
    setAnalyzedResult(null);
    triggerToast("Analyzing commitment image context with Gemini Pro...");

    try {
      const commaIdx = analyzerPreview.indexOf(",");
      const base64Bytes = analyzerPreview.substring(commaIdx + 1);
      const mime = analyzerFile?.type || "image/png";

      const res = await fetch("/api/gemini/analyze-syllabus", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ imageBase64: base64Bytes, mimeType: mime }),
      });

      if (!res.ok) {
        const errorMsg = await parseApiError(res, "Syllabus extract engine failed.");
        throw new Error(errorMsg);
      }

      const parsedResult = await res.json();
      setAnalyzedResult(parsedResult.extractedText);
      setNewCommitment(parsedResult.extractedText);
      if (parsedResult.approximateDeadline) {
        triggerToast(`Found deadline approximation: ${parsedResult.approximateDeadline}`);
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`Analysis error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Triggers OCR multi-commitment extraction via Gemini Vision
  const handleOcrExtraction = async () => {
    if (!analyzerPreview) return;
    setIsOcrProcessing(true);
    setExtractedCommitments([]);
    triggerToast("Gemini Vision OCR is scanning your document for multiple commitments...");

    try {
      const commaIdx = analyzerPreview.indexOf(",");
      const base64Bytes = analyzerPreview.substring(commaIdx + 1);
      const mime = analyzerFile?.type || "image/png";

      const res = await fetch("/api/gemini/ocr-commitments", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ imageBase64: base64Bytes, mimeType: mime }),
      });

      if (!res.ok) {
        const errorMsg = await parseApiError(res, "Gemini OCR engine failed.");
        throw new Error(errorMsg);
      }

      const parsedResult = await res.json();
      
      const mapped = (parsedResult.commitments || []).map((c: any, idx: number) => ({
        id: `extracted_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        title: c.title || "Extracted Task",
        deadline: c.deadline || "",
        description: c.description || "",
        estimatedMinutes: c.estimatedMinutes || 60,
        confidence: c.confidence || 80
      }));

      setExtractedCommitments(mapped);
      setOcrOverallConfidence(parsedResult.overallConfidence || 85);
      setIsOcrReviewOpen(true);
      triggerToast(`Extracted ${mapped.length} potential commitments from image!`);
    } catch (err: any) {
      console.error(err);
      triggerToast(`OCR extraction error: ${err.message}`);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleUpdateExtractedCommitment = (id: string, field: keyof OCRExtractedCommitment, value: any) => {
    setExtractedCommitments(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleDeleteExtractedCommitment = (id: string) => {
    setExtractedCommitments(prev => prev.filter(c => c.id !== id));
    triggerToast("Commitment removed from review queue.");
  };

  const handleImportExtractedCommitments = async () => {
    if (extractedCommitments.length === 0) return;
    setIsAnalyzing(true);
    triggerToast(`Importing ${extractedCommitments.length} commitments into Saarthi Planner...`);
    
    let importedCount = 0;
    try {
      for (const item of extractedCommitments) {
        const targetText = item.description || item.title;
        let deadlineIso = "";
        if (item.deadline) {
          deadlineIso = new Date(item.deadline).toISOString();
        } else {
          const defaultDate = new Date();
          defaultDate.setDate(defaultDate.getDate() + 3);
          deadlineIso = defaultDate.toISOString();
        }

        const response = await fetch("/api/gemini/task-planner", {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({ commitment: targetText }),
        });

        if (!response.ok) {
          const errorMsg = await parseApiError(response, `Failed to decompose "${item.title}".`);
          throw new Error(errorMsg);
        }

        const generatedData = await response.json();

        const subtaskArray: Subtask[] = (generatedData.subtasks || []).map((s: any, idx: number) => ({
          id: `sub_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          title: (s.title && s.title.trim()) ? s.title.trim() : `Milestone Task ${idx + 1}`,
          estimatedMinutes: s.estimatedMinutes || 45,
          done: false,
          order: s.order || idx + 1,
        }));

        if (subtaskArray.length === 0) {
          subtaskArray.push({
            id: `sub_${Date.now()}_0`,
            title: "Setup and initial commitment requirements mapping",
            estimatedMinutes: item.estimatedMinutes || 45,
            done: false,
            order: 1,
          });
        }

        const syncedTotalMinutes = subtaskArray.reduce((sum, s) => sum + s.estimatedMinutes, 0);

        const newTaskObj = {
          userId: user!.uid,
          title: item.title,
          description: item.description || item.title,
          complexity: generatedData.complexity || "medium",
          totalEffortMinutes: syncedTotalMinutes,
          deadline: deadlineIso,
          subtasks: subtaskArray,
          sessionsPlanned: subtaskArray.length,
          sessionsCompleted: 0,
          riskFactors: generatedData.riskFactors || [],
          createdAt: new Date().toISOString(),
          googleCalendarSynced: false,
          googleTasksSynced: false,
        };

        if (user!.isSimulated) {
          setTasks(prev => {
            const id = "local_task_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
            const updated = [...prev, { ...newTaskObj, id, riskScore: 0, riskZone: "safe" as const }];
            saveLocalTasks(user!.uid, updated);
            return updated;
          });
        } else {
          try {
            await addDoc(collection(db, "tasks"), newTaskObj);
          } catch (dbErr: any) {
            console.warn("Firestore addDoc failed for imported OCR commitment, falling back:", dbErr);
            setTasks(prev => {
              const id = "local_task_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
              const updated = [...prev, { ...newTaskObj, id, riskScore: 0, riskZone: "safe" as const }];
              saveLocalTasks(user!.uid, updated);
              return updated;
            });
          }
        }
        importedCount++;
      }

      triggerToast(`Successfully imported ${importedCount} commitments! flowing into Planner, Risk Engine, & Calendar systems.`);
      setExtractedCommitments([]);
      setIsOcrReviewOpen(false);
      setAnalyzerFile(null);
      setAnalyzerPreview(null);
    } catch (err: any) {
      console.error(err);
      triggerToast(`Import Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle subtask completion inside Firestore
  const handleToggleSubtask = async (task: Task, subtaskId: string) => {
    let finalUpdatedSubtasks: Subtask[] = [];
    let finalSessionsCompleted = 0;

    // Fast-update local React state and save to local storage
    setTasks(prevTasks => {
      const currentTask = prevTasks.find(t => t.id === task.id) || task;
      
      const updatedSubtasks = currentTask.subtasks.map((s) => {
        if (s.id === subtaskId) {
          return { ...s, done: !s.done };
        }
        return s;
      });

      finalSessionsCompleted = updatedSubtasks.filter((s) => s.done).length;
      finalUpdatedSubtasks = updatedSubtasks;

      const updatedTasks = prevTasks.map((t) => {
        if (t.id === task.id) {
          return { ...t, subtasks: updatedSubtasks, sessionsCompleted: finalSessionsCompleted };
        }
        return t;
      });
      if (user) {
        saveLocalTasks(user.uid, updatedTasks);
      }
      return updatedTasks;
    });

    if (user!.isSimulated) {
      triggerToast("Execution state synchronized locally.");
      return;
    }

    try {
      const docRef = doc(db, "tasks", task.id);
      await updateDoc(docRef, {
        subtasks: finalUpdatedSubtasks,
        sessionsCompleted: finalSessionsCompleted,
      });
    } catch (err: any) {
      console.error("Failed to update milestone:", err);
      triggerToast("Failed to sync state to server.");
    }
  };

  // Trigger explicit rescue plan for threatened tasks using gemini-3.1-pro-preview with Thinking Level: HIGH via recoveryService
  const handleGenerateRescuePlan = async (task: Task) => {
    triggerToast("Invoking high-thinking strategist to build dynamic recovery plan...");
    try {
      const activePendingSubtasks = task.subtasks.filter((s) => !s.done).map((s) => s.title);

      const res = await fetch("/api/gemini/recovery-plan", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          taskTitle: task.title,
          description: task.description,
          hoursRemaining: getHoursRemaining(task.deadline),
          totalEffortMinutes: task.totalEffortMinutes,
          subtasksLeftNames: activePendingSubtasks,
        }),
      });

      if (!res.ok) {
        const errorMsg = await parseApiError(res, "Rescue generation failed.");
        throw new Error(errorMsg);
      }
      const plan = await res.json();

      const docRef = doc(db, "tasks", task.id);

      const updatedTasks = tasks.map((t) => {
        if (t.id === task.id) {
          return { ...t, recoveryPlan: plan };
        }
        return t;
      });
      setTasks(updatedTasks);
      saveLocalTasks(user!.uid, updatedTasks);

      if (!user!.isSimulated) {
        try {
          await updateDoc(docRef, {
            recoveryPlan: plan,
          });
        } catch (dbErr) {
          console.warn("Firestore updateDoc for rescue failed, updated locally instead:", dbErr);
        }
      }

      triggerToast("Rescue roadmap established! Read advice below the task card.");

    } catch (err: any) {
      console.error(err);
      triggerToast(`Rescue roadmap fail: ${err.message}`);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
      if (user) saveLocalTasks(user.uid, updatedTasks);
      return updatedTasks;
    });

    if (user && !user.isSimulated) {
      try {
        const docRef = doc(db, "tasks", taskId);
        await updateDoc(docRef, updates);
      } catch (err: any) {
        console.error("Failed to update task:", err);
        triggerToast("Failed to sync edit to server.");
      }
    }
  };

  // Delete task commitment
  const handleDeleteTask = async (taskId: string) => {
    // Fast local state update
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(updatedTasks);
    if (user) {
      saveLocalTasks(user.uid, updatedTasks);
    }

    if (user && user.isSimulated) {
      triggerToast("Commitment cleared locally.");
      return;
    }

    try {
      await deleteDoc(doc(db, "tasks", taskId));
      triggerToast("Commitment cleared.");
    } catch (err) {
      console.warn("Firestore delete failed, updated locally instead:", err);
      triggerToast("Commitment cleared locally.");
    }
  };

  // Snooze task deadline
  const handleSnoozeDeadline = async (task: Task, days: number) => {
    const oldDeadline = new Date(task.deadline);
    const newDeadline = new Date(oldDeadline.getTime() + days * 24 * 3600 * 1000).toISOString();

    const updatedTasks = tasks.map((t) => {
      if (t.id === task.id) {
        return { ...t, deadline: newDeadline, riskZone: computeRiskScore({ ...t, deadline: newDeadline }).zone };
      }
      return t;
    });
    setTasks(updatedTasks);
    saveLocalTasks(user!.uid, updatedTasks);

    if (user!.isSimulated) {
      triggerToast(`Deadline extended by ${days} day(s) locally.`);
      return;
    }

    try {
      const docRef = doc(db, "tasks", task.id);
      await updateDoc(docRef, {
        deadline: newDeadline,
      });
      triggerToast(`Deadline extended by ${days} day(s).`);
    } catch (err: any) {
      console.warn("Firestore sync failed, updated locally instead:", err);
      triggerToast(`Local deadline extended (cloud sync pending).`);
    }
  };

  // Compile premium actionable context & resource suggestions via server-side Gemini
  const handleGetReminderContext = async (task: Task) => {
    setGeneratingContextTaskId(task.id);
    triggerToast("Compiling actionable context, next steps, and helper templates...");
    try {
      const res = await fetch("/api/gemini/reminder-context", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          deadline: task.deadline,
        }),
      });

      if (!res.ok) {
        const errorMsg = await parseApiError(res, "Unable to compile contextual reminder advice.");
        throw new Error(errorMsg);
      }

      const result = await res.json();
      const docRef = doc(db, "tasks", task.id);
      const remContext = {
        nextLogicalStep: result.nextLogicalStep || "Commence initial planning draft.",
        contextualAdvice: result.contextualAdvice || "Take action immediately to break starting friction.",
        resourceSearchQueries: result.resourceSearchQueries || [],
        draftTemplate: result.draftTemplate || "",
        createdAt: new Date().toISOString(),
      };

      // Fast local update
      const updatedTasks = tasks.map((t) => {
        if (t.id === task.id) {
          return { ...t, reminderContext: remContext };
        }
        return t;
      });
      setTasks(updatedTasks);
      saveLocalTasks(user!.uid, updatedTasks);

      if (!user!.isSimulated) {
        try {
          await updateDoc(docRef, {
            reminderContext: remContext
          });
        } catch (dbErr) {
          console.warn("Firestore updateDoc for context failed, saved locally instead:", dbErr);
        }
      }

      setExpandedReminderTaskId(task.id);
      triggerToast("Reminder context established. Tap 'Action Steps' to view details.");
    } catch (err: any) {
      console.error(err);
      triggerToast(`Failed to build context: ${err.message}`);
    } finally {
      setGeneratingContextTaskId(null);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    triggerToast("Custom starter template copied to clipboard!");
  };

  // Push work sessions directly to Google Calendar using cached accessToken
  const handleSyncToGoogleCalendar = async (task: Task) => {
    if (!accessToken) {
      triggerToast("Missing valid Google access tokens. Sign out and log in again.");
      return;
    }

    const confirmSync = window.confirm(
      `Synchronize sessions for '${task.title}' directly to your private Google Calendar with permission?`
    );
    if (!confirmSync) return;

    triggerToast("Executing Google Calendar orchestration...");

    try {
      const docRef = doc(db, "tasks", task.id);
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      const result = await calendarService.syncTaskCalendarEvents(task, accessToken, userTimeZone);

      const calendarSynced = result.syncState.syncStatus === "synced";

      const updatedTasks = tasks.map((t) => {
        if (t.id === task.id) {
          return {
            ...t,
            googleCalendarSynced: calendarSynced,
            calendarSync: result.syncState,
            subtasks: result.updatedSubtasks
          };
        }
        return t;
      });
      setTasks(updatedTasks);
      saveLocalTasks(user!.uid, updatedTasks);

      if (!user!.isSimulated) {
        try {
          await updateDoc(docRef, {
            googleCalendarSynced: calendarSynced,
            calendarSync: result.syncState,
            subtasks: result.updatedSubtasks
          });
        } catch (dbErr) {
          console.warn("Firestore update for Calendar sync failed, updated locally instead:", dbErr);
        }
      }

      if (result.tokenExpired) {
        triggerToast("Google Authorization Expired! Please click sign-out and log in again to sync.");
      } else if (result.syncState.syncStatus === "synced") {
        triggerToast(`Google Calendar fully synced! ${result.syncState.syncedEvents}/${result.syncState.totalEvents} blocks online.`);
      } else if (result.syncState.syncStatus === "partial") {
        triggerToast(`Partial success: ${result.syncState.syncedEvents}/${result.syncState.totalEvents} blocks online. Remaining failed due to transient API errors. Click Sync to retry.`);
      } else {
        triggerToast(`Calendar sync failed: ${result.errors.join(", ")}`);
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`Calendar write failed: ${err.message}`);
    }
  };

  // Push to Google Tasks using cached accessToken
  const handleSyncToGoogleTasks = async (task: Task) => {
    if (!accessToken) {
      triggerToast("Missing valid Google access tokens. Sign out and log in again.");
      return;
    }

    const confirmSync = window.confirm(
      `Create ${task.subtasks.length} synced nodes inside Google Tasks with permission?`
    );
    if (!confirmSync) return;

    triggerToast("Synchronizing subtasks with Google Tasks list...");

    try {
      const docRef = doc(db, "tasks", task.id);
      let successCount = 0;

      for (const sub of task.subtasks) {
        const taskData = {
          title: `[Saarthi] ${sub.title}`,
          notes: `Decomposed checklist item for commitment: ${task.title}. Duration: ${sub.estimatedMinutes} minutes.`,
          due: task.deadline,
        };

        const res = await fetch("https://www.googleapis.com/tasks/v1/lists/@default/tasks", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(taskData),
        });

        if (res.ok) {
          successCount++;
        }
      }

      const updatedTasks = tasks.map((t) => {
        if (t.id === task.id) {
          return { ...t, googleTasksSynced: true };
        }
        return t;
      });
      setTasks(updatedTasks);
      saveLocalTasks(user!.uid, updatedTasks);

      if (!user!.isSimulated) {
        try {
          await updateDoc(docRef, { googleTasksSynced: true });
        } catch (dbErr) {
          console.warn("Firestore update for Google Tasks sync failed, updated locally instead:", dbErr);
        }
      }

      triggerToast(`Synced ${successCount} milestones to Google Tasks successfully.`);
    } catch (err: any) {
      console.error(err);
      triggerToast(`Google Tasks write failed: ${err.message}`);
    }
  };

  // Multi-turn chatbot sender
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    const newHistoryMsg: ChatMessage = { role: "user", text: userMsg, timestamp: Date.now() };
    const updatedChats = [...chats, newHistoryMsg];

    setChats(updatedChats);
    setChatInput("");
    setIsChatSending(true);
    setChatSources([]);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          messages: chats,
          userMessage: userMsg,
          persona: chatPersona,
          enableSearch: enableGrounding,
          enableThinking: enableThinking,
        }),
      });

      if (!res.ok) {
        const errorMsg = await parseApiError(res, "Chat bot communication error.");
        throw new Error(errorMsg);
      }

      const result = await res.json();
      const modelAnswer = result.text || "I was unable to synthesize a response.";

      setChats((prev) => [
        ...prev,
        { role: "model", text: modelAnswer, timestamp: Date.now() },
      ]);

      if (result.sources && result.sources.length > 0) {
        setChatSources(result.sources);
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`Chat module fail: ${err.message}`);
    } finally {
      setIsChatSending(false);
    }
  };

  // Play custom synthesized speech using gemini-3.1-flash-tts-preview
  const handlePlayTTS = async (textToSpeak: string) => {
    setIsSpeaking(true);
    triggerToast("Synthesizing custom verbal brief using Gemini Speech...");

    try {
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ text: textToSpeak, voice: ttsVoice }),
      });

      if (!res.ok) {
        const errorMsg = await parseApiError(res, "TTS voice engine failed.");
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const b64Data = data.audio;

      // Decode base64 bytes to create object URI play stream
      const audioUrlString = `data:audio/mp3;base64,${b64Data}`;
      setAudioUrl(audioUrlString);

      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrlString;
        audioPlayerRef.current.play();
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`TTS Synthesis Error: ${err.message}`);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Create customized Motivation wallpaper / poster image using gemini-3-pro-image-preview
  const handleGeneratePoster = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImg(true);
    setGeneratedImg(null);
    triggerToast(`Generating high quality visual wallpaper using Gemini Pro Image...`);

    try {
      const res = await fetch("/api/gemini/generate-image", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ prompt: imagePrompt, size: imageSize }),
      });

      if (!res.ok) {
        const errorMsg = await parseApiError(res, "Image compiler error.");
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.isFallback) {
        setGeneratedImg(data.imageUrl);
        triggerToast(data.warning || "Custom motivation wallpaper compiled matching your visual request!");
      } else {
        const base64Str = data.imageData;
        const parsedUrl = `data:image/png;base64,${base64Str}`;
        setGeneratedImg(parsedUrl);
        triggerToast("Motivation poster compiled matching user specifications!");
      }
      setImagePrompt("");
    } catch (err: any) {
      console.error(err);
      triggerToast(`Image generator fail: ${err.message}`);
    } finally {
      setIsGeneratingImg(false);
    }
  };

  // --- Real-time Voice Conversations (Live API - WebSockets Bridge) ---
  const handleStartLiveCall = async () => {
    if (isLiveActive) {
      handleStopLiveCall();
      return;
    }

    setIsLiveActive(true);
    setLiveLog("Connecting WebSocket bridge...");
    triggerToast("Activating real-time PCM voice stream with Gemini...");

    try {
      // Determine protocol
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const keyParam = userApiKey ? `?key=${encodeURIComponent(userApiKey)}` : "";
      const wsUrl = `${wsProto}//${window.location.host}/live${keyParam}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Audio configs
      // Output sample rate 24kHz
      const outCtx = new AudioContext({ sampleRate: 24000 });
      outputAudioCtxRef.current = outCtx;
      nextStartTimeRef.current = outCtx.currentTime;

      // Input sample rate 16kHz
      const inCtx = new AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inCtx;

      ws.onopen = async () => {
        setLiveLog("Live Voice Connection Active! Speak clearly...");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;

          const source = inCtx.createMediaStreamSource(stream);
          const processor = inCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          source.connect(processor);
          processor.connect(inCtx.destination);

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const floatData = e.inputBuffer.getChannelData(0);
            
            // Convert Float32Array PCM to 16-bit little endian array buffer
            const buffer = new ArrayBuffer(floatData.length * 2);
            const view = new DataView(buffer);
            let offset = 0;
            for (let i = 0; i < floatData.length; i++, offset += 2) {
              let s = Math.max(-1, Math.min(1, floatData[i]));
              view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }

            // Convert to base64
            const base64 = btoa(
              new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
            );
            ws.send(JSON.stringify({ audio: base64 }));
          };
        } catch (mediaErr) {
          console.error("Microphone access failed:", mediaErr);
          setLiveLog("Microphone Access Blocked");
          handleStopLiveCall();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setLiveLog(`Error: ${msg.error}`);
            handleStopLiveCall();
          } else if (msg.audio) {
            // Queue up the raw base64 PCM little-endian audio for smooth 24kHz playback
            const binaryString = atob(msg.audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const view = new DataView(bytes.buffer);
            const samples = len / 2;
            const floatPCM = new Float32Array(samples);
            for (let i = 0; i < samples; i++) {
              floatPCM[i] = view.getInt16(i * 2, true) / 32768;
            }

            // Playback using audio buffer source
            const audioBuf = outCtx.createBuffer(1, samples, 24000);
            audioBuf.copyToChannel(floatPCM, 0);

            const sourceNode = outCtx.createBufferSource();
            sourceNode.buffer = audioBuf;
            sourceNode.connect(outCtx.destination);

            // Audio synchronization logic to avoid overlap with network jitter
            const curTime = outCtx.currentTime;
            if (nextStartTimeRef.current < curTime) {
              nextStartTimeRef.current = curTime;
            }
            sourceNode.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuf.duration;
          } else if (msg.interrupted) {
            // Stop and purge pending playback on user interruption
            nextStartTimeRef.current = outCtx.currentTime;
          }
        } catch (e) {
          console.error("Failed handling WS payload:", e);
        }
      };

      ws.onclose = () => {
        setLiveLog("Voice Call ended");
        handleStopLiveCall();
      };

      ws.onerror = (err) => {
        console.error("Live Call WebSocket Error:", err);
        setLiveLog("Connection Fault");
        handleStopLiveCall();
      };
    } catch (err: any) {
      console.error(err);
      setLiveLog("Activation Failure");
      setIsLiveActive(false);
    }
  };

  const handleStopLiveCall = () => {
    setIsLiveActive(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    triggerToast("PCM voice session deactivated.");
  };

  // Pre-fill prompt text helper
  const loadExampleCommitment = (prompt: string) => {
    setNewCommitment(prompt);
    triggerToast("Sample template injected.");
  };

  // --- RENDERING VIEWS ---

  if (currentView === "landing") {
    return (
      <LandingPage
        onLaunch={() => setCurrentView("workspace")}
        isLoggedIn={!needsAuth && !!user}
      />
    );
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-50 to-indigo-50/40 dark:from-zinc-950 dark:to-indigo-950/20 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white dark:selection:bg-indigo-500 transition-all">
        {/* Glow ambient decors */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500 opacity-[0.08] dark:opacity-[0.04] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[450px] h-[450px] rounded-full bg-pink-500 opacity-[0.05] dark:opacity-[0.02] blur-[100px] pointer-events-none" />

        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-8 md:p-10 shadow-xl shadow-slate-100 dark:shadow-none relative z-10 text-center transition-all animate-fade-in">
          <div className="inline-flex items-center justify-center p-4 bg-indigo-50 dark:bg-zinc-800 rounded-2xl mb-6">
            <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>

          <h1 className="text-3xl font-bold font-display tracking-tight text-slate-900 dark:text-zinc-100 mb-1">
            Saarthi
          </h1>
          <p className="text-xs font-mono tracking-wider text-indigo-600 dark:text-indigo-400 uppercase mb-5 font-semibold">
            AI Execution Partner
          </p>

          <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed mb-8">
            Traditional tools build reminders, which causes screen fatigue. Saarthi targets <strong>actual execution</strong>. Map assignments, decompose steps, and manage deadlines with strategic intelligence.
          </p>

          {/* Safe Mode Sandbox Pre-arranged Quick-Access Widget */}
          <div className="mb-6 p-4.5 bg-indigo-50/60 dark:bg-zinc-950/30 border border-indigo-100/80 dark:border-zinc-800/80 rounded-2xl text-left space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 tracking-tight">AI Studio Preview - 1-Click Access</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
              If Google Popups are restricted inside this iframe browser, you can instantly load your secure workspace profile with a single click:
            </p>
            <button
              onClick={() => {
                const simUserObj = {
                  uid: "sandbox_sim_luv_sarkari_gmail_com",
                  email: "sandbox@saarthi-platform.com",
                  displayName: "Workspace Owner",
                  photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
                  isSimulated: true
                };
                setUser(simUserObj as any);
                localStorage.setItem("saarthi_current_simulated_user", JSON.stringify(simUserObj));
                setNeedsAuth(false);
                triggerToast(`Premium Workspace profile loaded successfully.`);
              }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98] cursor-pointer"
            >
              Launch Premium Workspace
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-100 dark:border-zinc-800"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-400 dark:text-zinc-500 font-medium uppercase tracking-wider font-mono">or connect via services</span>
            <div className="flex-grow border-t border-slate-100 dark:border-zinc-800"></div>
          </div>

          {/* Correct style-compliant Google Sign-In Button */}
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 py-3.5 px-6 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none transition-all cursor-pointer shadow-sm hover:scale-[1.01]"
          >
            {isLoggingIn ? (
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  transform="scale(0.5)"
                ></path>
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  transform="scale(0.5)"
                ></path>
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  transform="scale(0.5)"
                ></path>
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  transform="scale(0.5)"
                ></path>
              </svg>
            )}
            <span className="text-slate-800 dark:text-zinc-200 font-semibold text-xs">
              {isLoggingIn ? "Initializing secure profile..." : "Sign in with Google"}
            </span>
          </button>

          {loginErrorHint && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-left text-xs text-amber-800 dark:text-amber-400 space-y-2.5 shadow-sm">
              <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                Browser Popup Blocked inside Sandbox Iframe
              </p>
              <div className="text-[11px] text-amber-800 dark:text-amber-400/90 leading-normal space-y-1.5">
                <p>
                  Because Saarthi is running inside a secure sandbox preview iframe, your browser may block the sign-in popup. To sign in successfully:
                </p>
                <div className="pl-3.5 space-y-1 font-medium list-decimal">
                  <p>1. Open Saarthi in a new tab by clicking the button below (popups work perfectly there).</p>
                  <p>2. Or, look at your browser address bar's top-right corner to allow blocked popups for this site.</p>
                </div>
              </div>
              <p className="opacity-80 font-mono text-[9px] break-all bg-amber-100/50 dark:bg-amber-950/50 p-1.5 rounded border border-amber-200/50 dark:border-amber-900/40 text-amber-800 dark:text-amber-400">
                Error Details: {loginErrorHint}
              </p>
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, "_blank")}
                  className="inline-flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold py-2 px-3.5 rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab & Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSandboxForm(true);
                    setSandboxEmail("");
                    setSandboxName("");
                  }}
                  className="inline-flex items-center gap-1.5 bg-white dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-zinc-800 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-zinc-800 text-[11px] font-semibold py-2 px-3.5 rounded-lg transition-all cursor-pointer"
                >
                  Use Sandbox Mode
                </button>
              </div>
            </div>
          )}

          {!showSandboxForm ? (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowSandboxForm(true);
                  setSandboxEmail("");
                  setSandboxName("");
                }}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-350 bg-slate-50 dark:bg-zinc-800 border border-slate-200/50 dark:border-zinc-800 py-2 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                Or custom Sandbox Profile name setup →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSandboxLogin} className="mt-5 p-4.5 bg-slate-50 dark:bg-zinc-950/20 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl text-left space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Custom Profile Access</h3>
                <button
                  type="button"
                  onClick={() => setShowSandboxForm(false)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-350 cursor-pointer uppercase font-bold"
                >
                  Close
                </button>
              </div>

              <div>
                <label className="block text-[9px] font-mono tracking-wider uppercase text-slate-400 dark:text-zinc-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={sandboxEmail}
                  onChange={(e) => setSandboxEmail(e.target.value)}
                  placeholder="e.g. yourname@example.com"
                  className="w-full text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 outline-none transition-all font-sans"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono tracking-wider uppercase text-slate-400 dark:text-zinc-500 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={sandboxName}
                  onChange={(e) => setSandboxName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 outline-none transition-all font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-800 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-slate-900 dark:hover:bg-zinc-200 py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer text-center"
              >
                Access Custom Profile
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800/80 flex justify-center gap-6">
            <div className="text-center">
              <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-500">Firestore</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">Durable Cloud</p>
            </div>
            <div className="border-r border-slate-100 dark:border-zinc-800/80 h-6 my-auto" />
            <div className="text-center">
              <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">G-Workspace</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">Secure Sync</p>
            </div>
            <div className="border-r border-slate-100 dark:border-zinc-800/80 h-6 my-auto" />
            <div className="text-center">
              <p className="text-xs font-mono font-bold text-rose-500 dark:text-rose-400">Live PCM</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">Speech Bridge</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800/80">
            <button
              onClick={() => setCurrentView("landing")}
              className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer inline-flex items-center gap-1"
            >
              ← Return to Landing Page & Philosophy
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafb] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-sans relative flex flex-col overflow-x-hidden selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-950 transition-all">
      {/* Toast Notification HUD */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 py-3.5 px-6 rounded-xl shadow-xl flex items-center gap-3 transition-all duration-300 transform animate-bounce">
          <Sparkles className="text-zinc-600 dark:text-zinc-400 w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Hidden audio element for TTS playback */}
      <audio ref={audioPlayerRef} style={{ display: "none" }} />

      {/* API Configuration Warning Banner */}
      {user && !SYSTEM_ADMIN_EMAILS.includes(user.email?.toLowerCase() || "") && !userApiKey && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-400 px-4 py-2.5 text-center text-xs flex items-center justify-center gap-2 relative z-50 shadow-sm transition-all">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
          <span>
            Logged in as <strong className="font-semibold text-amber-900">{user.email}</strong>. Press <strong>"Configure Key"</strong> to set your private Gemini API Key to run Planner integrations.
          </span>
          <button
            onClick={() => {
              setSettingsKeyInput(userApiKey);
              setShowSettingsModal(true);
            }}
            className="ml-3 bg-zinc-900 text-white hover:bg-zinc-800 font-medium px-3 py-1 rounded-lg text-[10px] transition-all cursor-pointer shadow-sm"
          >
            Configure Key
          </button>
        </div>
      )}

      {/* Main App Bar Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 border-b border-zinc-200/80 dark:border-zinc-800/80 shadow-sm transition-all duration-200">
        <div className="max-w-[1400px] mx-auto px-6 py-4.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-white shadow-md ring-1 ring-zinc-950/5 hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">Saarthi</span>
                <span className="text-[9px] font-mono tracking-wider font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100/50 dark:border-indigo-900/40 px-2 py-0.5 rounded-md uppercase">
                  Copilot
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium tracking-tight mt-0.5">Syllabus Decomposition & Progress Assurance</span>
            </div>
          </div>

          {/* Center: Workspace Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900/80 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
            <button
              onClick={() => setCurrentView("workspace")}
              className={`px-4.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                currentView === "workspace"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/40 dark:border-zinc-700/80"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView("tasks")}
              className={`px-4.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                currentView === "tasks"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/40 dark:border-zinc-700/80"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setCurrentView("landing")}
              className={`px-4.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                currentView === "landing"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/40 dark:border-zinc-700/80"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Philosophy
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {/* Google Services Connection indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-400 font-semibold shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Workspace Synced</span>
            </div>

            {/* Profile Pill */}
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/85 dark:border-zinc-800 pl-2 pr-3 py-1.5 rounded-xl shadow-sm">
              {user.photoURL ? (
                <img src={user.photoURL} alt="pfp" className="w-5 h-5 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-800" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
                  <UserIcon className="w-3 h-3" />
                </div>
              )}
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 max-w-[100px] truncate">{user.displayName || user.email}</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="p-2 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-xl border border-zinc-200/80 dark:border-zinc-800 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-500 animate-pulse" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-xl border border-zinc-200/80 dark:border-zinc-800 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 bg-white dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-xl border border-zinc-200/80 dark:border-zinc-800 hover:border-rose-100 dark:hover:border-rose-900 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Single Screen Split Grid */}
      <main className={`max-w-[1400px] mx-auto w-full px-6 py-8 grid grid-cols-1 ${currentView === "workspace" ? "lg:grid-cols-12" : ""} gap-8 items-stretch flex-1`}>
        
        {currentView === "workspace" ? (
          <>
            {/* LEFT COLUMN: Commitment planner and active cards (Grid bounds: 8 cols for robust dashboard weight) */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              {/* Section 1: Dual-Input Cognitive Capture Deck */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm overflow-hidden relative transition-all">
            <div className="mb-5">
              <h2 className="text-base font-semibold font-display text-zinc-950 dark:text-zinc-50 mb-1 flex items-center gap-2">
                <Brain className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                Commitment Planner
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Declare an upcoming milestone or upload a syllabus to let Saarthi auto-decompose and structure your timeline.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: Natural text entry */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-4">
                <div className="space-y-2 flex-1 flex flex-col">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold block">1. Natural Intention Entry</span>
                  <div className="relative flex-1 min-h-[90px]">
                    <textarea
                      value={newCommitment}
                      onChange={(e) => setNewCommitment(e.target.value)}
                      placeholder="e.g., 'Draft 2500 word thesis abstract due Friday' or 'Prepare presentation slides for PM launch sync scheduled on Thursday noon'..."
                      className="w-full h-full bg-zinc-50/50 dark:bg-zinc-950/25 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-300 focus:bg-white dark:focus:bg-zinc-900 rounded-xl p-4 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none resize-none min-h-[90px] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-[10px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400 mb-1.5 font-medium">Target Project Deadline</label>
                    <input
                      type="datetime-local"
                      value={customDeadline}
                      onChange={(e) => setCustomDeadline(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950/25 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-300 focus:bg-white dark:focus:bg-zinc-900 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={() => handleAddCommitment()}
                    disabled={isPlanning || !newCommitment.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 py-3 px-6 rounded-xl text-xs font-semibold text-white dark:text-zinc-950 transition-all cursor-pointer shadow-sm shrink-0"
                  >
                    {isPlanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-zinc-300 dark:text-zinc-700" />
                        Decompose Task
                      </>
                    )}
                  </button>
                </div>
              </div>
              {/* Right Column: Syllabus/Document Analyzer Component */}
              <div className="lg:col-span-5">
                <SyllabusAnalyzer
                  analyzerFile={analyzerFile}
                  setAnalyzerFile={setAnalyzerFile}
                  analyzerPreview={analyzerPreview}
                  setAnalyzerPreview={setAnalyzerPreview}
                  isAnalyzing={isAnalyzing}
                  isOcrProcessing={isOcrProcessing}
                  onAnalyzeSyllabus={handleAnalyzeSyllabus}
                  onOcrExtraction={handleOcrExtraction}
                  triggerToast={triggerToast}
                />
              </div>
            </div>

            {/* Example Prompts helper */}
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-medium uppercase">Quick templates:</span>
              <button
                onClick={() => loadExampleCommitment("Physics Lab Assignment on thermal conductivity, due Friday. Need outline, formula spreadsheet, and 12-page write-up completed.")}
                className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Physics Lab Report
              </button>
              <button
                onClick={() => loadExampleCommitment("Refactor user database schema, setup firebase firestore indexing, and compile the local dev build on server by Thursday noon.")}
                className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Tech Refactoring
              </button>
            </div>
          </div>

          {/* Section 2: Active Commitments Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-zinc-700" />
                Active Commitments ({tasks.length})
              </h3>
              <div className="text-xs text-zinc-500 font-mono">
                Executive Overview
              </div>
            </div>

            {/* Visual Upgraded Dedicated "Execution Health" Dashboard */}
            {tasks.length > 0 && (() => {
              const scoredTasks = tasks.map(t => ({
                ...t,
                analysis: computeRiskScore(t)
              }));

              const totalActive = scoredTasks.length;
              const criticalCount = scoredTasks.filter(t => t.analysis.zone === "critical").length;
              const watchCount = scoredTasks.filter(t => t.analysis.zone === "watch").length;
              const recoveryCount = scoredTasks.filter(t => t.analysis.zone === "critical" || t.analysis.zone === "watch" || t.recoveryPlan).length;
              
              const totalConfidence = scoredTasks.reduce((sum, t) => sum + t.analysis.completionConfidence, 0);
              const avgConfidence = totalActive > 0 ? Math.round(totalConfidence / totalActive) : 100;

              const incompleteSorted = scoredTasks
                .filter(t => t.subtasks.some(s => !s.done))
                .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
              const nextDeadlines = incompleteSorted.slice(0, 2);
              let healthStatus = "Pacing Stabilized";
              let healthBadgeClass = "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50";
              let statusText = "Milestone indicators reflect standard buffer margin.";
              let progressColor = "bg-emerald-600";
              if (criticalCount > 0) {
                healthStatus = "Strategic Drift Detected";
                healthBadgeClass = "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50";
                statusText = `${criticalCount} milestone(s) at critical risk pace. Intervention recommended.`;
                progressColor = "bg-rose-600";
              } else if (watchCount > 0) {
                healthStatus = "Attention Encouraged";
                healthBadgeClass = "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50";
                statusText = "Monitor buffer ratios or consider early action steps.";
                progressColor = "bg-amber-500";
              }

              return (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-6 transition-all">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                      Progress Statistics
                    </h4>
                    <span className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${healthBadgeClass}`}>
                      {healthStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                    {/* Clean Progress Ring replacement */}
                    <div className="md:col-span-5 flex flex-col justify-center bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/60 dark:border-zinc-800/50 p-5 rounded-xl text-center space-y-3 relative overflow-hidden">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400 dark:text-zinc-500 font-semibold block">Decomposition Safety</span>
                        <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center justify-center">
                          {avgConfidence}
                          <span className="text-lg text-zinc-500 dark:text-zinc-400 font-normal">%</span>
                        </div>
                      </div>
                      
                      {/* Clean Horizontal progress indicator */}
                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${progressColor} transition-all duration-500`} style={{ width: `${avgConfidence}%` }} />
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans leading-relaxed">
                        Aggregated safety buffer based on current velocity.
                      </p>
                    </div>

                    {/* Metrics cards and Upcoming Targets */}
                    <div className="md:col-span-7 flex flex-col justify-between gap-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-zinc-50/40 dark:bg-zinc-950/20 border border-zinc-200/60 dark:border-zinc-800/50 rounded-xl p-3 text-center">
                          <span className="text-[9px] font-mono tracking-wider uppercase text-zinc-400 dark:text-zinc-500 font-bold block mb-1">Active</span>
                          <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-mono leading-none">{totalActive}</span>
                          <span className="text-[8px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mt-1 block">Commitments</span>
                        </div>

                        <div className={`border rounded-xl p-3 text-center transition-all ${
                          criticalCount > 0 
                            ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400" 
                            : "bg-zinc-50/40 dark:bg-zinc-950/20 border-zinc-200/60 dark:border-zinc-800/50 text-zinc-500 dark:text-zinc-400"
                        }`}>
                          <span className="text-[9px] font-mono tracking-wider uppercase font-bold block mb-1">Critical</span>
                          <span className={`text-xl font-bold font-mono leading-none ${criticalCount > 0 ? "text-rose-700 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-50"}`}>{criticalCount}</span>
                          <span className="text-[8px] font-semibold uppercase mt-1 block">Sprints</span>
                        </div>

                        <div className={`border rounded-xl p-3 text-center transition-all ${
                          recoveryCount > 0 
                            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400" 
                            : "bg-zinc-50/40 dark:bg-zinc-950/20 border-zinc-200/60 dark:border-zinc-800/50 text-zinc-500 dark:text-zinc-400"
                        }`}>
                          <span className="text-[9px] font-mono tracking-wider uppercase font-bold block mb-1">Recovery</span>
                          <span className={`text-xl font-bold font-mono leading-none ${recoveryCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-50"}`}>{recoveryCount}</span>
                          <span className="text-[8px] font-semibold uppercase mt-1 block">Suggestions</span>
                        </div>
                      </div>

                      {nextDeadlines.length > 0 && (
                        <div className="bg-zinc-50/40 dark:bg-zinc-950/20 border border-zinc-200/60 dark:border-zinc-800/50 p-3 rounded-xl space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            <span>Upcoming Deadlines</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {nextDeadlines.map(t => {
                              const hrs = getHoursRemaining(t.deadline);
                              const comp = t.subtasks.filter(s => s.done).length;
                              const tot = t.subtasks.length;
                              const progressPct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
                              const analysis = computeRiskScore(t);
                              return (
                                <div key={t.id} className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/50 p-2 rounded-lg flex items-center justify-between gap-2 text-[11px] transition-all">
                                  <div className="truncate flex-1 min-w-0">
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-50 block truncate">{t.title}</span>
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 block">{hrs.toFixed(1)}h left · {progressPct}%</span>
                                  </div>
                                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                    analysis.zone === "critical" ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                  }`}>
                                    {analysis.completionConfidence}%
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans text-center pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    💡 {statusText} Use proactive calendar integration to maintain buffer targets.
                  </p>
                </div>
              );
            })()}

            {/* Smart Alerts & Urgent Execution Radar Banner */}
            {tasks.some(t => t.riskZone === "critical" || t.riskZone === "watch" || t.reminderContext) && (
              <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/60 dark:border-amber-900/40 p-4 rounded-xl relative overflow-hidden space-y-3 shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    Attention Areas
                  </h4>
                  <span className="text-[9px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-200/40 dark:border-amber-900/50 uppercase">Action Advised</span>
                </div>
                <div className="space-y-2">
                  {tasks
                    .filter(t => t.riskZone === "critical" || t.riskZone === "watch" || t.reminderContext)
                    .slice(0, 2)
                    .map(t => {
                       const hoursLeft = getHoursRemaining(t.deadline);
                       const isMeeting = t.title.toLowerCase().match(/meeting|prep|interview|session|skype|zoom|call|catchup|sync|talk/i);
                       return (
                         <div key={t.id} className="bg-white dark:bg-zinc-900 border border-amber-200/40 dark:border-zinc-800/80 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-sm transition-all">
                           <div className="space-y-1 flex-1">
                             <div className="flex items-center gap-2">
                               <span className={`w-2 h-2 rounded-full ${t.riskZone === "critical" ? "bg-rose-500 animate-ping" : "bg-amber-500"}`} />
                               <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-xs truncate max-w-[200px]">{t.title}</span>
                               <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">({hoursLeft.toFixed(1)}h left)</span>
                             </div>
                             {t.reminderContext ? (
                               <p className="text-[11px] text-zinc-600 dark:text-zinc-350" id={`radar-next-step-${t.id}`}>
                                 <span className="text-zinc-800 dark:text-zinc-200 font-sans font-semibold">Next Action: </span>
                                 "{t.reminderContext.nextLogicalStep}"
                               </p>
                             ) : (
                               <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                 {isMeeting ? "👥 Upcoming scheduled interaction. Promptly prepare agenda notes or relevant details." : "📝 Project deadline is starting to approach. Build clear action steps to begin."}
                               </p>
                             )}
                           </div>
                           <div className="flex items-center gap-2 self-end md:self-auto shrink-0 animate-fade-in">
                             {t.reminderContext ? (
                               <button
                                 onClick={() => {
                                   setExpandedReminderTaskId(expandedReminderTaskId === t.id ? null : t.id);
                                   setExpandedTaskId(t.id);
                                 }}
                                 className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-sans font-semibold text-[10px] px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-all cursor-pointer"
                                 id={`radar-btn-toggle-${t.id}`}
                               >
                                 {expandedReminderTaskId === t.id ? "Hide Guide" : "View Resources"}
                               </button>
                             ) : (
                               <button
                                 onClick={() => handleGetReminderContext(t)}
                                 disabled={generatingContextTaskId === t.id}
                                 className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 shadow-sm"
                                 id={`radar-btn-fetch-${t.id}`}
                               >
                                 {generatingContextTaskId === t.id ? (
                                   <>
                                     <RefreshCw className="w-3 h-3 animate-spin" />
                                     Compiling...
                                   </>
                                 ) : (
                                   <>
                                     <Sparkles className="w-3 h-3 text-zinc-300 dark:text-zinc-700" />
                                     {isMeeting ? "Prep Agenda" : "Build Steps"}
                                   </>
                                 )}
                               </button>
                             )}
                           </div>
                         </div>
                       );
                    })}
                </div>
              </div>
            )}

            {true && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm text-zinc-700 dark:text-zinc-350 space-y-6 transition-all hover:shadow-md">
                <div className="text-center space-y-1">
                  <div className="inline-flex p-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-full mb-1">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold font-display text-zinc-950 dark:text-zinc-50 tracking-tight">Decompose your first commitment</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Saarthi acts as an executive assistant that transforms raw course materials and milestone notes into an actionable roadmap synced directly with your daily workflow.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pillar 1 */}
                  <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-xl space-y-1.5 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-inner">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                        <Brain className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">1. Milestone Decomposition</h4>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-405 leading-relaxed">
                      Deconstruct complex tasks into structured, realistic sprints before deadlines creep up.
                    </p>
                  </div>

                  {/* Pillar 2 */}
                  <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-xl space-y-1.5 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-inner">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">2. Completion Predictability</h4>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-405 leading-relaxed">
                      Simple, honest calculations evaluate workload, calendar constraints, and hours left to estimate confidence.
                    </p>
                  </div>

                  {/* Pillar 3 */}
                  <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-xl space-y-1.5 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-inner">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                        <Calendar className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">3. Google Calendar Locking</h4>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-405 leading-relaxed">
                      Directly block time in your Google Calendar and Tasks lists to defend deep execution sessions.
                    </p>
                  </div>

                  {/* Pillar 4 */}
                  <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-xl space-y-1.5 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-inner">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                        <Volume2 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">4. Focused Support</h4>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-405 leading-relaxed">
                      Instantly request structural advice, draft templates, and search helpful web resources.
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs leading-relaxed shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-700 dark:bg-zinc-300 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Ready to begin?</strong> Select the physics demo template to populate immediate targets:
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadExampleCommitment("Physics Lab Assignment on thermal conductivity, due Friday. Need outline, formula spreadsheet, and 12-page write-up completed.")}
                      className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm text-[11px] shrink-0"
                    >
                      🧪 Physics Demo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Tabbed Active Assistant Workspace (Grid bounds: 4 cols) */}
        <div className="lg:col-span-4 flex flex-col">
          <AssistantPanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            chatPersona={chatPersona}
            setChatPersona={setChatPersona}
            enableGrounding={enableGrounding}
            setEnableGrounding={setEnableGrounding}
            enableThinking={enableThinking}
            setEnableThinking={setEnableThinking}
            chats={chats}
            chatInput={chatInput}
            setChatInput={setChatInput}
            isChatSending={isChatSending}
            chatSources={chatSources}
            onSendChatMessage={handleSendChatMessage}
            isLiveActive={isLiveActive}
            liveLog={liveLog}
            onStartLiveCall={handleStartLiveCall}
            imagePrompt={imagePrompt}
            setImagePrompt={setImagePrompt}
            imageSize={imageSize}
            setImageSize={setImageSize}
            isGeneratingImg={isGeneratingImg}
            onGeneratePoster={handleGeneratePoster}
            generatedImg={generatedImg}
            triggerToast={triggerToast}
          />
        </div>
          </>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display text-zinc-950 dark:text-zinc-50">All Tasks</h2>
                <p className="text-xs text-zinc-500">Your full list of commitments and progress.</p>
              </div>
            </div>
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                No active commitments. Go to Dashboard to plan your tasks.
              </div>
            ) : (
              <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleSubtask={handleToggleSubtask}
                    onDeleteTask={handleDeleteTask}
                    onGenerateRescuePlan={handleGenerateRescuePlan}
                    onGetReminderContext={handleGetReminderContext}
                    onSyncGoogleCalendar={handleSyncToGoogleCalendar}
                    onSnoozeDeadline={handleSnoozeDeadline}
                    isGeneratingContext={generatingContextTaskId === task.id}
                    expandedSubtask={expandedTaskId === task.id}
                    onToggleExpandSubtask={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    expandedReminder={expandedReminderTaskId === task.id}
                    onToggleExpandReminder={() => setExpandedReminderTaskId(expandedReminderTaskId === task.id ? null : task.id)}
                    accessToken={accessToken}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        activeTab={activeSettingsTab}
        setActiveTab={setActiveSettingsTab}
        settingsKeyInput={settingsKeyInput}
        setSettingsKeyInput={setSettingsKeyInput}
        onSaveSettings={handleSaveSettings}
        telegramChatId={telegramChatId}
        telegramUsername={telegramUsername}
        onUnlinkTelegram={handleUnlinkTelegram}
        onTriggerBriefing={handleTriggerBriefing}
        telegramCode={telegramCode}
        isGeneratingTelegramCode={isGeneratingTelegramCode}
        onGenerateLinkCode={handleGenerateLinkCode}
        triggerToast={triggerToast}
      />

      <OCRReviewModal
        isOpen={isOcrReviewOpen}
        onClose={() => {
          setExtractedCommitments([]);
          setIsOcrReviewOpen(false);
        }}
        extractedCommitments={extractedCommitments}
        ocrOverallConfidence={ocrOverallConfidence}
        isAnalyzing={isAnalyzing}
        onUpdateCommitment={handleUpdateExtractedCommitment}
        onDeleteCommitment={handleDeleteExtractedCommitment}
        onImportCommitments={handleImportExtractedCommitments}
      />
    </div>
  );
}
