import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Moon,
  Bot,
  Activity,
  ArrowRight,
  Zap,
  HeartHandshake,
  AlertCircle,
  BrainCircuit,
  CalendarDays,
  MessageSquare,
  BarChart,
  Menu,
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
  setDoc,
} from "firebase/firestore";
import {
  initAuth,
  googleSignIn,
  logout as authLogout,
  getAccessToken,
  db,
} from "./lib/firebase";
import {
  Task,
  ChatMessage,
  Subtask,
  OCRExtractedCommitment,
  CompanionProfile,
} from "./types";
import {
  computeRiskScore,
  getHoursRemaining,
  formatTimeRemaining,
} from "./lib/riskEngine";
import { calendarService } from "./services/calendarService";
import LandingPage from "./components/LandingPage";
import TaskCard from "./components/TaskCard";
import SettingsModal from "./components/SettingsModal";
import SyllabusAnalyzer from "./components/SyllabusAnalyzer";
import OCRReviewModal from "./components/OCRReviewModal";
import AssistantPanel from "./components/AssistantPanel";
import ActivationCenter from "./components/ActivationCenter";
import EngagementInsights from "./components/EngagementInsights";
import RecoveryCenter from "./components/RecoveryCenter";
import CompanionCenter from "./components/CompanionCenter";
import CompanionOnboarding from "./components/CompanionOnboarding";
import LearningCenter from "./components/LearningCenter";
import AdaptivePlanningCenter from "./components/AdaptivePlanningCenter";
import { behavioralIntelligenceService } from "./services/behavioralIntelligenceService";

const SYSTEM_ADMIN_EMAILS = [
  "luv.sarkari@gmail.com",
  "admin@saarthi-platform.com",
  "sandbox_sim_luv_sarkari_gmail_com",
  "sandbox@saarthi-platform.com",
];

async function parseApiError(
  res: Response,
  defaultMessage: string,
): Promise<string> {
  let errMessage = defaultMessage;
  try {
    const errData = await res.json();
    if (errData.error) {
      errMessage = errData.error;
    }
  } catch (_) {}

  const lowerErr = errMessage.toLowerCase();
  if (
    lowerErr.includes("503") ||
    lowerErr.includes("unavailable") ||
    lowerErr.includes("demand")
  ) {
    return "AI is currently experiencing high demand and is unavailable. Please wait a moment and try again.";
  } else if (
    lowerErr.includes("429") ||
    lowerErr.includes("quota") ||
    lowerErr.includes("exhausted")
  ) {
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
  const [currentView, setCurrentView] = useState<
    "landing" | "workspace" | "planner" | "tasks" | "engagement"
  >("landing");
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasDismissedActivationPrompt, setHasDismissedActivationPrompt] = useState(false);
  const [companionProfile, setCompanionProfile] =
    useState<CompanionProfile | null>(null);

  // Task list states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksSortBy, setTasksSortBy] = useState<
    "created" | "deadline" | "risk"
  >("created");
  const [isTasksSortDropdownOpen, setIsTasksSortDropdownOpen] =
    useState<boolean>(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [tasksSearchQuery, setTasksSearchQuery] = useState("");
  const [newCommitment, setNewCommitment] = useState("");
  const [customDeadline, setCustomDeadline] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);

  // Chat interface states
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPersona, setChatPersona] = useState<
    "shield" | "navigator" | "coach"
  >("navigator");
  const [enableGrounding, setEnableGrounding] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatSources, setChatSources] = useState<any[]>([]);

  // Syllabus parsing state
  const [analyzerFile, setAnalyzerFile] = useState<File | null>(null);
  const [analyzerPreview, setAnalyzerPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedResult, setAnalyzedResult] = useState<string | null>(null);

  // Modal States for Background Engines
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [isAdaptiveModalOpen, setIsAdaptiveModalOpen] = useState(false);

  // OCR Workflow States
  const [extractedCommitments, setExtractedCommitments] = useState<
    OCRExtractedCommitment[]
  >([]);
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

  // --- PRODUCTION VOICE REBUILD STATES ---
  const [liveState, _setLiveState] = useState<
    | "idle"
    | "initializing"
    | "connecting"
    | "listening"
    | "processing"
    | "speaking"
    | "interrupted"
    | "disconnected"
    | "reconnecting"
    | "error"
  >("idle");
  const [liveErrorMessage, setLiveErrorMessage] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [modelTranscript, setModelTranscript] = useState("");
  const [micVolume, setMicVolume] = useState(0);
  const [playbackVolume, setPlaybackVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<
    "excellent" | "good" | "fair" | "poor"
  >("excellent");
  const [conversationDuration, setConversationDuration] = useState(0);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [availableSpeakers, setAvailableSpeakers] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");

  const liveStateRef = useRef<string>("idle");
  const setLiveState = (
    s:
      | "idle"
      | "initializing"
      | "connecting"
      | "listening"
      | "processing"
      | "speaking"
      | "interrupted"
      | "disconnected"
      | "reconnecting"
      | "error",
  ) => {
    liveStateRef.current = s;
    _setLiveState(s);
  };
  const isMutedRef = useRef(false);
  const selectedMicIdRef = useRef("");
  const selectedSpeakerIdRef = useRef("");
  const activeAudioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const lastSpeechTimeRef = useRef<number>(0);
  const userSpeakingRef = useRef<boolean>(false);
  const durationIntervalRef = useRef<any>(null);
  const micVolumeRef = useRef<number>(0);
  const playbackVolumeRef = useRef<number>(0);
  const reconnectionAttemptsRef = useRef<number>(0);
  const pingIntervalRef = useRef<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const userTranscriptRef = useRef("");

  const handleSyncTranscriptToChat = (text?: string) => {
    const transcriptToCommit =
      text !== undefined ? text : userTranscriptRef.current;
    if (transcriptToCommit.trim()) {
      setChats((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (
          lastMsg &&
          lastMsg.role === "user" &&
          lastMsg.text === transcriptToCommit
        ) {
          return prev;
        }
        return [
          ...prev,
          { role: "user", text: transcriptToCommit, timestamp: Date.now() },
        ];
      });
      setUserTranscript("");
      userTranscriptRef.current = "";
    }
  };
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // Local notification toasts
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Active assistant tab
  const [activeTab, setActiveTab] = useState<
    "chat" | "voice" | "poster" | "help"
  >("chat");

  // Track expanded task subtasks view
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Track expanded task reminder details
  const [expandedReminderTaskId, setExpandedReminderTaskId] = useState<
    string | null
  >(null);

  // Track loading status for reminder contexts
  const [generatingContextTaskId, setGeneratingContextTaskId] = useState<
    string | null
  >(null);

  // Track selected labels for filtering
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // User Custom API Key settings
  const [userApiKey, setUserApiKey] = useState<string>("");
  const [settingsKeyInput, setSettingsKeyInput] = useState<string>("");
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState<boolean>(false);

  // Telegram states
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [telegramAlertsEnabled, setTelegramAlertsEnabled] = useState(true);
  const [telegramAlertSlots, setTelegramAlertSlots] = useState<string[]>([
    "10:00",
  ]);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramCodeExpires, setTelegramCodeExpires] = useState<string | null>(
    null,
  );
  const [isGeneratingTelegramCode, setIsGeneratingTelegramCode] =
    useState<boolean>(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    "api" | "telegram" | "companion" | "recovery"
  >("api");

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
    const storedSimulated = localStorage.getItem(
      "saarthi_current_simulated_user",
    );
    if (storedSimulated) {
      try {
        const parsed = JSON.parse(storedSimulated);
        setUser(parsed);
        setNeedsAuth(false);
        triggerToast(
          `Welcome back, ${parsed.displayName || "Warrior"} (Sandbox Mode)!`,
        );
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
      },
    );
    return () => unsubscribe();
  }, []);

  // Scroll to top on view/auth transitions
  useEffect(() => {
    if (currentView === "workspace" && !needsAuth) {
      window.scrollTo(0, 0);
    }
  }, [currentView, needsAuth]);

  // Track Dashboard Session
  useEffect(() => {
    if (user && currentView === "workspace") {
      behavioralIntelligenceService.trackEvent({
        userId: user.uid,
        eventType: "DASHBOARD_SESSION",
        confidence: 100
      });
    }
  }, [currentView, user]);

  // Sync / write tasks to local storage
  const saveLocalTasks = (uid: string, newTasks: Task[]) => {
    localStorage.setItem(
      "saarthi_local_tasks_" + uid,
      JSON.stringify(newTasks),
    );
  };

  // Fetch or Subscribe to Firestore tasks for current authenticated user
  useEffect(() => {
    if (!user) return;

    if (user.isSimulated) {
      // Direct fast load from local storage
      const localTasksStr = localStorage.getItem(
        "saarthi_local_tasks_" + user.uid,
      );
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
            return (
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
            );
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
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
            deadline:
              d.deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
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
          return (
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          );
        });
        setTasks(dbTasks);
        saveLocalTasks(user.uid, dbTasks);
      },
      (error) => {
        console.warn(
          "Firestore subscription failed. Falling back to local tasks:",
          error,
        );
        const localTasksStr = localStorage.getItem(
          "saarthi_local_tasks_" + user.uid,
        );
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
              return (
                new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
              );
            });
            setTasks(processed);
          } catch (e) {
            console.error("Failed to parse local tasks fallback:", e);
          }
        }
      },
    );
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
    const storedLocalKey = localStorage.getItem(
      "saarthi_gemini_api_key_" + user.uid,
    );
    if (storedLocalKey) {
      setUserApiKey(storedLocalKey);
      setSettingsKeyInput(storedLocalKey);
    }

    // Skip Firestore listener if simulated
    if (user.isSimulated) {
      const savedSimProfile = localStorage.getItem(
        "saarthi_companion_profile_" + user.uid,
      );
      if (savedSimProfile) {
        try {
          setCompanionProfile(JSON.parse(savedSimProfile));
        } catch (e) {
          setShowOnboarding(true);
        }
      } else {
        setShowOnboarding(true);
      }
      return;
    }

    // Subscribe to Firestore settings
    const qDoc = doc(db, "userSettings", user.uid);
    const unsubscribe = onSnapshot(
      qDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data) {
            if (data.companionProfile) {
              setCompanionProfile(data.companionProfile);
            } else {
              setShowOnboarding(true);
            }
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
            if (data.telegramAlertsEnabled !== undefined) {
              setTelegramAlertsEnabled(data.telegramAlertsEnabled);
            }
            if (data.telegramAlertSlots) {
              setTelegramAlertSlots(data.telegramAlertSlots);
            }
          }
        }
      },
      (error) => {
        console.warn("Could not read user settings from Firestore:", error);
      },
    );

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
        if (telegramAlertsEnabled) {
          fetch("/api/telegram/trigger-alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.uid, task }),
          }).catch((err) =>
            console.warn("Failed to dispatch Telegram recovery alert:", err),
          );
        }
      }

      // Track the current zone
      prevZonesRef.current[task.id] = nextZone;
    });
  }, [tasks, user, telegramAlertsEnabled]);

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
              geminiApiKey: userApiKey,
              telegramAlertsEnabled,
              telegramAlertSlots,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          }),
        });
      } catch (e) {
        console.warn("Could not sync state to server cache:", e);
      }
    };

    // Debounce state synchronization slightly to avoid slamming the server on typing
    const timer = setTimeout(syncWithServerCache, 2000);
    return () => clearTimeout(timer);
  }, [
    user,
    tasks,
    telegramChatId,
    telegramUsername,
    userApiKey,
    telegramAlertsEnabled,
    telegramAlertSlots,
  ]);

  // Poll server state periodically to detect linking success or task changes from Telegram Bot
  useEffect(() => {
    if (!user) return;

    const pollServerState = async () => {
      try {
        const res = await fetch(
          `/api/telegram/get-state?userId=${encodeURIComponent(user.uid)}`,
        );
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
              await setDoc(
                docRef,
                {
                  telegramChatId: data.telegramChatId,
                  telegramUsername: data.telegramUsername || "",
                  telegramLinkedAt: new Date().toISOString(),
                },
                { merge: true },
              ).catch((err) =>
                console.warn(
                  "Failed to write userSettings back to Firestore:",
                  err,
                ),
              );
            }
          }

          // 2. Merge any tasks updated by the Telegram Bot
          if (data.tasks && data.tasks.length > 0) {
            setTasks((prevTasks) => {
              let changed = false;
              const merged = prevTasks.map((prevTask) => {
                const serverTask = data.tasks.find(
                  (t: any) => t.id === prevTask.id,
                );
                if (serverTask) {
                  if (
                    serverTask.lastUpdated &&
                    serverTask.lastUpdated > (prevTask.lastUpdated || 0)
                  ) {
                    changed = true;
                    // Write back to Firestore if not simulated
                    if (!user.isSimulated) {
                      const docRef = doc(db, "tasks", prevTask.id);
                      setDoc(docRef, serverTask, { merge: true }).catch((err) =>
                        console.warn(
                          "Failed to update task back to Firestore:",
                          err,
                        ),
                      );
                    } else {
                      // Update simulated tasks in local storage
                      const localTasksKey = "saarthi_local_tasks_" + user.uid;
                      const stored = localStorage.getItem(localTasksKey);
                      if (stored) {
                        try {
                          const parsed = JSON.parse(stored) as Task[];
                          const updatedParsed = parsed.map((pt) =>
                            pt.id === prevTask.id
                              ? { ...pt, ...serverTask }
                              : pt,
                          );
                          localStorage.setItem(
                            localTasksKey,
                            JSON.stringify(updatedParsed),
                          );
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
        await setDoc(
          docRef,
          {
            geminiApiKey: trimmedKey,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      setShowSettingsModal(false);
      triggerToast("Settings saved successfully! Custom API Key is live.");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      triggerToast(`Fails to save settings: ${err.message}`);
    }
  };

  const handleSaveTelegramSettings = async (
    enabled: boolean,
    slots: string[],
  ) => {
    if (!user || user.isSimulated) return;
    try {
      const docRef = doc(db, "userSettings", user.uid);
      await setDoc(
        docRef,
        {
          telegramAlertsEnabled: enabled,
          telegramAlertSlots: slots,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      // Update local state so it triggers the sync-state to the server
      setTelegramAlertsEnabled(enabled);
      setTelegramAlertSlots(slots);

      triggerToast("Telegram alert settings saved!");
    } catch (err: any) {
      console.error("Error saving Telegram settings:", err);
      triggerToast("Failed to save Telegram settings");
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
    setNeedsAuth(true);
    setCurrentView("landing");
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
      uid:
        "sandbox_sim_" +
        sandboxEmail
          .trim()
          .toLowerCase()
          .replace(/[^a-zA-Z0-9]/g, "_"),
      email: sandboxEmail.trim().toLowerCase(),
      displayName: nameToUse,
      photoURL:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      isSimulated: true,
    };

    setUser(simUserObj as any);
    localStorage.setItem(
      "saarthi_current_simulated_user",
      JSON.stringify(simUserObj),
    );
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
  const handleAddCommitment = async (
    textOverload?: string,
    deadlineOverload?: string,
    titleOverload?: string,
  ) => {
    if (isPlanning) return; // Prevent duplicate concurrent planning operations and duplicate records

    const targetText = textOverload || newCommitment;
    if (!targetText.trim()) return;

    setIsPlanning(true);
    triggerToast(
      "Saarthi is strategically framing your execution blueprint...",
    );

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

      let aiContext = "";
      if (user && !user.isSimulated) {
        const profile = await behavioralIntelligenceService.getLearningProfile(user.uid);
        aiContext = behavioralIntelligenceService.generateAiContext(profile);
      }

      const response = await fetch("/api/gemini/task-planner", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ commitment: targetText, aiContext }),
      });

      if (!response.ok) {
        const errorMsg = await parseApiError(
          response,
          "Failed to reach Saarthi task decomposition model.",
        );
        throw new Error(errorMsg);
      }

      const generatedData = await response.json();

      // Ensure task and subtasks remain perfectly synchronized & validated
      const subtaskArray: Subtask[] = (generatedData.subtasks || []).map(
        (s: any, idx: number) => ({
          id: `sub_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          title:
            s.title && s.title.trim()
              ? s.title.trim()
              : `Milestone Task ${idx + 1}`,
          estimatedMinutes: s.estimatedMinutes || 45,
          done: false,
          order: s.order || idx + 1,
        }),
      );

      if (subtaskArray.length === 0) {
        subtaskArray.push({
          id: `sub_${Date.now()}_0`,
          title: "Setup and initial commitment requirements mapping",
          estimatedMinutes: 45,
          done: false,
          order: 1,
        });
      }

      const syncedTotalMinutes = subtaskArray.reduce(
        (sum, s) => sum + s.estimatedMinutes,
        0,
      );

      const newTaskObj = {
        userId: user!.uid,
        title:
          titleOverload ||
          (generatedData.title && generatedData.title.trim()
            ? generatedData.title.trim()
            : targetText),
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
        const localTasks = [
          ...tasks,
          { ...newTaskObj, id, riskScore: 0, riskZone: "safe" as const },
        ];
        setTasks(localTasks);
        saveLocalTasks(user!.uid, localTasks);
      } else {
        try {
          await addDoc(collection(db, "tasks"), newTaskObj);
          await behavioralIntelligenceService.trackEvent({
            userId: user!.uid,
            eventType: "TASK_CREATED",
            taskCategory: newTaskObj.title,
            confidence: 100
          });
        } catch (dbErr: any) {
          console.warn(
            "Firestore addDoc failed, using local storage fallback:",
            dbErr,
          );
          const id = "local_task_" + Date.now();
          const localTasks = [
            ...tasks,
            { ...newTaskObj, id, riskScore: 0, riskZone: "safe" as const },
          ];
          setTasks(localTasks);
          saveLocalTasks(user!.uid, localTasks);
        }
      }

      setNewCommitment("");
      setCustomDeadline("");
      triggerToast("Commitment established. Subtasks mapped & scheduled.");
      setCurrentView("planner");
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
        const errorMsg = await parseApiError(
          res,
          "Syllabus extract engine failed.",
        );
        throw new Error(errorMsg);
      }

      const parsedResult = await res.json();
      setAnalyzedResult(parsedResult.extractedText);
      setNewCommitment(parsedResult.extractedText);
      if (parsedResult.approximateDeadline) {
        triggerToast(
          `Found deadline approximation: ${parsedResult.approximateDeadline}`,
        );
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
    triggerToast(
      "Gemini Vision OCR is scanning your document for multiple commitments...",
    );

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

      const mapped = (parsedResult.commitments || []).map(
        (c: any, idx: number) => ({
          id: `extracted_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          title: c.title || "Extracted Task",
          deadline: c.deadline || "",
          description: c.description || "",
          estimatedMinutes: c.estimatedMinutes || 60,
          confidence: c.confidence || 80,
        }),
      );

      setExtractedCommitments(mapped);
      setOcrOverallConfidence(parsedResult.overallConfidence || 85);
      setIsOcrReviewOpen(true);
      triggerToast(
        `Extracted ${mapped.length} potential commitments from image!`,
      );
    } catch (err: any) {
      console.error(err);
      triggerToast(`OCR extraction error: ${err.message}`);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleUpdateExtractedCommitment = (
    id: string,
    field: keyof OCRExtractedCommitment,
    value: any,
  ) => {
    setExtractedCommitments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const handleDeleteExtractedCommitment = (id: string) => {
    setExtractedCommitments((prev) => prev.filter((c) => c.id !== id));
    triggerToast("Commitment removed from review queue.");
  };

  const handleImportExtractedCommitments = async () => {
    if (extractedCommitments.length === 0) return;
    setIsAnalyzing(true);
    triggerToast(
      `Importing ${extractedCommitments.length} commitments into Saarthi Planner...`,
    );

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

        let aiContext = "";
        if (user && !user.isSimulated) {
          const profile = await behavioralIntelligenceService.getLearningProfile(user.uid);
          aiContext = behavioralIntelligenceService.generateAiContext(profile);
        }

        const response = await fetch("/api/gemini/task-planner", {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({ commitment: targetText, aiContext }),
        });

        if (!response.ok) {
          const errorMsg = await parseApiError(
            response,
            `Failed to decompose "${item.title}".`,
          );
          throw new Error(errorMsg);
        }

        const generatedData = await response.json();

        const subtaskArray: Subtask[] = (generatedData.subtasks || []).map(
          (s: any, idx: number) => ({
            id: `sub_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            title:
              s.title && s.title.trim()
                ? s.title.trim()
                : `Milestone Task ${idx + 1}`,
            estimatedMinutes: s.estimatedMinutes || 45,
            done: false,
            order: s.order || idx + 1,
          }),
        );

        if (subtaskArray.length === 0) {
          subtaskArray.push({
            id: `sub_${Date.now()}_0`,
            title: "Setup and initial commitment requirements mapping",
            estimatedMinutes: item.estimatedMinutes || 45,
            done: false,
            order: 1,
          });
        }

        const syncedTotalMinutes = subtaskArray.reduce(
          (sum, s) => sum + s.estimatedMinutes,
          0,
        );

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
          setTasks((prev) => {
            const id =
              "local_task_" +
              Date.now() +
              "_" +
              Math.random().toString(36).substring(2, 5);
            const updated = [
              ...prev,
              { ...newTaskObj, id, riskScore: 0, riskZone: "safe" as const },
            ];
            saveLocalTasks(user!.uid, updated);
            return updated;
          });
        } else {
          try {
            await addDoc(collection(db, "tasks"), newTaskObj);
            await behavioralIntelligenceService.trackEvent({
              userId: user!.uid,
              eventType: "OCR_IMPORT",
              taskCategory: newTaskObj.title,
              confidence: 90
            });
          } catch (dbErr: any) {
            console.warn(
              "Firestore addDoc failed for imported OCR commitment, falling back:",
              dbErr,
            );
            setTasks((prev) => {
              const id =
                "local_task_" +
                Date.now() +
                "_" +
                Math.random().toString(36).substring(2, 5);
              const updated = [
                ...prev,
                { ...newTaskObj, id, riskScore: 0, riskZone: "safe" as const },
              ];
              saveLocalTasks(user!.uid, updated);
              return updated;
            });
          }
        }
        importedCount++;
      }

      triggerToast(
        `Successfully imported ${importedCount} commitments! flowing into Planner, Risk Engine, & Calendar systems.`,
      );
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
    setTasks((prevTasks) => {
      const currentTask = prevTasks.find((t) => t.id === task.id) || task;

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
          return {
            ...t,
            subtasks: updatedSubtasks,
            sessionsCompleted: finalSessionsCompleted,
            lastUpdated: Date.now(),
          };
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
        lastUpdated: Date.now(),
      });
      
      const subtask = task.subtasks.find((s) => s.id === subtaskId);
      if (subtask && !subtask.done) {
        // Was just checked as done
        await behavioralIntelligenceService.trackEvent({
          userId: user!.uid,
          eventType: "TASK_COMPLETED",
          subject: subtask.title,
          durationMinutes: subtask.estimatedMinutes,
          confidence: 100
        });
      }
    } catch (err: any) {
      console.error("Failed to update milestone:", err);
      triggerToast("Failed to sync state to server.");
    }
  };

  // Trigger explicit rescue plan for threatened tasks using gemini-3.1-pro-preview with Thinking Level: HIGH via recoveryService
  const handleGenerateRescuePlan = async (task: Task) => {
    triggerToast(
      "Invoking high-thinking strategist to build dynamic recovery plan...",
    );
    try {
      const activePendingSubtasks = task.subtasks
        .filter((s) => !s.done)
        .map((s) => s.title);

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
          console.warn(
            "Firestore updateDoc for rescue failed, updated locally instead:",
            dbErr,
          );
        }
      }

      triggerToast(
        "Rescue roadmap established! Read advice below the task card.",
      );
    } catch (err: any) {
      console.error(err);
      triggerToast(`Rescue roadmap fail: ${err.message}`);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    let finalUpdates = { ...updates, lastUpdated: Date.now() };

    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.map((t) => {
        if (t.id === taskId) {
          if (finalUpdates.isCompleted) {
            finalUpdates.subtasks = t.subtasks.map((s) => ({ ...s, done: true }));
          }
          return { ...t, ...finalUpdates };
        }
        return t;
      });
      if (user) saveLocalTasks(user.uid, updatedTasks);
      return updatedTasks;
    });

    if (user && !user.isSimulated) {
      try {
        const docRef = doc(db, "tasks", taskId);
        await updateDoc(docRef, finalUpdates);
      } catch (err: any) {
        console.error("Failed to update task:", err);
        triggerToast("Failed to sync edit to server.");
      }
    }
  };

  // Delete task commitment
  const handleDeleteTask = async (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
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
      if (taskToDelete && user) {
        await behavioralIntelligenceService.trackEvent({
          userId: user.uid,
          eventType: "TASK_DELETED",
          subject: taskToDelete.title,
          confidence: 100
        });
      }
    } catch (err) {
      console.warn("Firestore delete failed, updated locally instead:", err);
      triggerToast("Commitment cleared locally.");
    }
  };

  // Snooze task deadline
  const handleSnoozeDeadline = async (task: Task, days: number) => {
    const oldDeadline = new Date(task.deadline);
    const newDeadline = new Date(
      oldDeadline.getTime() + days * 24 * 3600 * 1000,
    ).toISOString();

    const updatedTasks = tasks.map((t) => {
      if (t.id === task.id) {
        return {
          ...t,
          deadline: newDeadline,
          riskZone: computeRiskScore({ ...t, deadline: newDeadline }).zone,
        };
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
      
      if (user) {
        await behavioralIntelligenceService.trackEvent({
          userId: user.uid,
          eventType: "TASK_SNOOZED",
          subject: task.title,
          metadata: { days },
          confidence: 80
        });
      }
    } catch (err: any) {
      console.warn("Firestore sync failed, updated locally instead:", err);
      triggerToast(`Local deadline extended (cloud sync pending).`);
    }
  };

  // Compile premium actionable context & resource suggestions via server-side Gemini
  const handleGetReminderContext = async (task: Task) => {
    setGeneratingContextTaskId(task.id);
    triggerToast(
      "Compiling actionable context, next steps, and helper templates...",
    );
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
        const errorMsg = await parseApiError(
          res,
          "Unable to compile contextual reminder advice.",
        );
        throw new Error(errorMsg);
      }

      const result = await res.json();
      const docRef = doc(db, "tasks", task.id);
      const remContext = {
        nextLogicalStep:
          result.nextLogicalStep || "Commence initial planning draft.",
        contextualAdvice:
          result.contextualAdvice ||
          "Take action immediately to break starting friction.",
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
            reminderContext: remContext,
          });
        } catch (dbErr) {
          console.warn(
            "Firestore updateDoc for context failed, saved locally instead:",
            dbErr,
          );
        }
      }

      setExpandedReminderTaskId(task.id);
      triggerToast(
        "Reminder context established. Tap 'Action Steps' to view details.",
      );
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
      triggerToast(
        "Missing valid Google access tokens. Sign out and log in again.",
      );
      return;
    }

    const confirmSync = window.confirm(
      `Synchronize sessions for '${task.title}' directly to your private Google Calendar with permission?`,
    );
    if (!confirmSync) return;

    triggerToast("Executing Google Calendar orchestration...");

    try {
      const docRef = doc(db, "tasks", task.id);
      const userTimeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      const result = await calendarService.syncTaskCalendarEvents(
        task,
        accessToken,
        userTimeZone,
      );

      const calendarSynced = result.syncState.syncStatus === "synced";

      const updatedTasks = tasks.map((t) => {
        if (t.id === task.id) {
          return {
            ...t,
            googleCalendarSynced: calendarSynced,
            calendarSync: result.syncState,
            subtasks: result.updatedSubtasks,
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
            subtasks: result.updatedSubtasks,
          });
        } catch (dbErr) {
          console.warn(
            "Firestore update for Calendar sync failed, updated locally instead:",
            dbErr,
          );
        }
      }

      if (result.tokenExpired) {
        triggerToast(
          "Google Authorization Expired! Please click sign-out and log in again to sync.",
        );
      } else if (result.syncState.syncStatus === "synced") {
        triggerToast(
          `Google Calendar fully synced! ${result.syncState.syncedEvents}/${result.syncState.totalEvents} blocks online.`,
        );
      } else if (result.syncState.syncStatus === "partial") {
        triggerToast(
          `Partial success: ${result.syncState.syncedEvents}/${result.syncState.totalEvents} blocks online. Remaining failed due to transient API errors. Click Sync to retry.`,
        );
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
      triggerToast(
        "Missing valid Google access tokens. Sign out and log in again.",
      );
      return;
    }

    const confirmSync = window.confirm(
      `Create ${task.subtasks.length} synced nodes inside Google Tasks with permission?`,
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

        const res = await fetch(
          "https://www.googleapis.com/tasks/v1/lists/@default/tasks",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(taskData),
          },
        );

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
          console.warn(
            "Firestore update for Google Tasks sync failed, updated locally instead:",
            dbErr,
          );
        }
      }

      triggerToast(
        `Synced ${successCount} milestones to Google Tasks successfully.`,
      );
    } catch (err: any) {
      console.error(err);
      triggerToast(`Google Tasks write failed: ${err.message}`);
    }
  };

  // Multi-turn chatbot sender
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    const newHistoryMsg: ChatMessage = {
      role: "user",
      text: userMsg,
      timestamp: Date.now(),
    };
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
          persona: companionProfile?.activeCompanion || chatPersona,
          enableSearch: enableGrounding,
          enableThinking: enableThinking,
          companionProfile: companionProfile,
          appContext: {
            currentView,
            tasksCount: tasks.length,
            riskTasks: tasks.filter(t => t.riskZone === 'danger').length,
          }
        }),
      });

      if (!res.ok) {
        const errorMsg = await parseApiError(
          res,
          "Chat bot communication error.",
        );
        throw new Error(errorMsg);
      }

      const result = await res.json();
      const modelAnswer =
        result.text || "I was unable to synthesize a response.";

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
    triggerToast(
      `Generating high quality visual wallpaper using Gemini Pro Image...`,
    );

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
        triggerToast(
          data.warning ||
            "Custom motivation wallpaper compiled matching your visual request!",
        );
      } else {
        const base64Str = data.imageData;
        const parsedUrl = `data:image/png;base64,${base64Str}`;
        setGeneratedImg(parsedUrl);
        triggerToast(
          "Motivation poster compiled matching user specifications!",
        );
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
  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");
      setAvailableMics(mics);
      setAvailableSpeakers(speakers);

      if (mics.length > 0 && !selectedMicIdRef.current) {
        setSelectedMicId(mics[0].deviceId);
        selectedMicIdRef.current = mics[0].deviceId;
      }
      if (speakers.length > 0 && !selectedSpeakerIdRef.current) {
        setSelectedSpeakerId(speakers[0].deviceId);
        selectedSpeakerIdRef.current = speakers[0].deviceId;
      }
    } catch (e) {
      console.warn("Failed to enumerate audio devices:", e);
    }
  };

  useEffect(() => {
    enumerateDevices();
  }, []);

  const handleToggleMute = () => {
    const nextVal = !isMuted;
    setIsMuted(nextVal);
    isMutedRef.current = nextVal;
    triggerToast(nextVal ? "Saarthi voice muted." : "Saarthi voice active.");
  };

  const handleSelectMic = (id: string) => {
    setSelectedMicId(id);
    selectedMicIdRef.current = id;
    triggerToast("Microphone input switched.");
    if (isLiveActive) {
      restartAudioInput();
    }
  };

  const handleSelectSpeaker = async (id: string) => {
    setSelectedSpeakerId(id);
    selectedSpeakerIdRef.current = id;
    triggerToast("Audio speaker output switched.");
    if (
      outputAudioCtxRef.current &&
      typeof (outputAudioCtxRef.current as any).setSinkId === "function"
    ) {
      try {
        await (outputAudioCtxRef.current as any).setSinkId(id);
      } catch (err) {
        console.warn("Could not set speaker output sink:", err);
      }
    }
  };

  const setupAudioProcessor = (inCtx: AudioContext, stream: MediaStream) => {
    const source = inCtx.createMediaStreamSource(stream);
    const inputAnalyser = inCtx.createAnalyser();
    inputAnalyser.fftSize = 128;
    source.connect(inputAnalyser);

    const processor = inCtx.createScriptProcessor(2048, 1, 1);
    processorRef.current = processor;

    inputAnalyser.connect(processor);
    processor.connect(inCtx.destination);

    processor.onaudioprocess = (e) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      const floatData = e.inputBuffer.getChannelData(0);

      // RMS calculation
      let sumSquares = 0;
      for (let i = 0; i < floatData.length; i++) {
        sumSquares += floatData[i] * floatData[i];
      }
      const rms = Math.sqrt(sumSquares / floatData.length);

      micVolumeRef.current = rms;
      setMicVolume(rms);

      // Noise Gate and Normalization
      const isSilence = rms < 0.005;
      if (isSilence) {
        for (let i = 0; i < floatData.length; i++) floatData[i] = 0;
      } else {
        let max = 0;
        for (let i = 0; i < floatData.length; i++) {
          const abs = Math.abs(floatData[i]);
          if (abs > max) max = abs;
        }
        if (max > 0 && max < 0.3) {
          const gain = 0.3 / max;
          for (let i = 0; i < floatData.length; i++) {
            floatData[i] = Math.max(-1, Math.min(1, floatData[i] * gain));
          }
        }
      }

      // Voice Activity Detection (VAD)
      const now = Date.now();
      const speechThreshold = 0.012;

      if (rms > speechThreshold) {
        lastSpeechTimeRef.current = now;
        if (!userSpeakingRef.current) {
          userSpeakingRef.current = true;

          // Full Barge-In Interruption
          if (liveStateRef.current === "speaking") {
            stopActiveAudioPlayback();
            setLiveState("interrupted");
            wsRef.current.send(JSON.stringify({ type: "interrupt" }));
            setTimeout(() => {
              setLiveState("listening");
            }, 150);
          }
        }
      } else if (
        userSpeakingRef.current &&
        now - lastSpeechTimeRef.current > 1200
      ) {
        userSpeakingRef.current = false;
        setLiveState("processing");
      }

      if (isMutedRef.current) {
        for (let i = 0; i < floatData.length; i++) floatData[i] = 0;
      }

      const buffer = new ArrayBuffer(floatData.length * 2);
      const view = new DataView(buffer);
      let offset = 0;
      for (let i = 0; i < floatData.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, floatData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }

      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (acc, byte) => acc + String.fromCharCode(byte),
          "",
        ),
      );
      wsRef.current.send(JSON.stringify({ audio: base64 }));
    };
  };

  const restartAudioInput = async () => {
    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }

      const inCtx = inputAudioCtxRef.current;
      if (!inCtx) return;

      const constraints: MediaStreamConstraints = {
        audio: selectedMicIdRef.current
          ? { deviceId: { exact: selectedMicIdRef.current } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      setupAudioProcessor(inCtx, stream);
    } catch (e: any) {
      console.error("Audio input restart failed:", e);
      triggerToast("Failed to switch microphone input device.");
    }
  };

  const handleStartLiveCall = async () => {
    if (isLiveActive) {
      handleStopLiveCall();
      return;
    }

    setIsLiveActive(true);
    setLiveState("initializing");
    setLiveErrorMessage("");
    setUserTranscript("");
    userTranscriptRef.current = "";
    setModelTranscript("");
    setMicVolume(0);
    setPlaybackVolume(0);
    setConversationDuration(0);
    setConnectionQuality("excellent");
    triggerToast("Connecting to Saarthi voice core...");

    let ws: WebSocket | null = null;

    try {
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const keyParam = userApiKey
        ? `&key=${encodeURIComponent(userApiKey)}`
        : "";
      const wsUrl = `${wsProto}//${window.location.host}/live?userId=${user?.uid || "simulated"}${keyParam}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setLiveState("connecting");
    } catch (err: any) {
      console.error("WebSocket initialization failed:", err);
      setLiveState("error");
      setLiveErrorMessage("Handshake with voice bridge failed.");
      setIsLiveActive(false);
      return;
    }

    try {
      // Output Audio Context (24kHz)
      const outCtx = new AudioContext({ sampleRate: 24000 });
      outputAudioCtxRef.current = outCtx;
      nextStartTimeRef.current = outCtx.currentTime;

      if (
        selectedSpeakerIdRef.current &&
        typeof (outCtx as any).setSinkId === "function"
      ) {
        try {
          await (outCtx as any).setSinkId(selectedSpeakerIdRef.current);
        } catch (err) {
          console.warn("Failed setting sink ID:", err);
        }
      }

      // Input Audio Context (16kHz)
      const inCtx = new AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inCtx;
    } catch (err: any) {
      console.error("Audio contexts initialization failed:", err);
      setLiveState("error");
      setLiveErrorMessage("Browser does not support Web Audio APIs.");
      setIsLiveActive(false);
      if (ws) ws.close();
      return;
    }

    setConversationDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setConversationDuration((prev) => prev + 1);
    }, 1000);

    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        setLatencyMs(Math.round(130 + Math.random() * 60));
      }
    }, 3000);

    ws.onopen = async () => {
      setLiveState("listening");
      reconnectionAttemptsRef.current = 0;

      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedMicIdRef.current
            ? { deviceId: { exact: selectedMicIdRef.current } }
            : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        micStreamRef.current = stream;

        await enumerateDevices();

        const inCtx = inputAudioCtxRef.current;
        if (!inCtx) return;

        setupAudioProcessor(inCtx, stream);
      } catch (mediaErr) {
        console.error("Microphone access failed:", mediaErr);
        setLiveState("error");
        setLiveErrorMessage("Permission to access microphone was denied.");
        handleStopLiveCall();
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.error) {
          console.error("Live session error from server:", msg.error);
          setLiveState("error");
          setLiveErrorMessage(msg.error);
          handleStopLiveCall();
        } else if (msg.audio) {
          const outCtx = outputAudioCtxRef.current;
          if (!outCtx) return;

          if (
            liveStateRef.current !== "speaking" &&
            liveStateRef.current !== "interrupted"
          ) {
            setLiveState("speaking");
          }

          const binaryString = atob(msg.audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const view = new DataView(bytes.buffer);
          const samples = len / 2;
          const floatPCM = new Float32Array(samples);

          let sumSquares = 0;
          for (let i = 0; i < samples; i++) {
            const s = view.getInt16(i * 2, true) / 32768;
            floatPCM[i] = s;
            sumSquares += s * s;
          }

          const rms = Math.sqrt(sumSquares / samples);
          playbackVolumeRef.current = rms;
          setPlaybackVolume(rms);

          const audioBuf = outCtx.createBuffer(1, samples, 24000);
          audioBuf.copyToChannel(floatPCM, 0);

          const sourceNode = outCtx.createBufferSource();
          sourceNode.buffer = audioBuf;
          sourceNode.connect(outCtx.destination);
          activeAudioSourcesRef.current.push(sourceNode);

          sourceNode.onended = () => {
            activeAudioSourcesRef.current =
              activeAudioSourcesRef.current.filter((s) => s !== sourceNode);
            if (activeAudioSourcesRef.current.length === 0) {
              setPlaybackVolume(0);
              if (liveStateRef.current === "speaking") {
                setLiveState("listening");
              }
            }
          };

          const curTime = outCtx.currentTime;
          if (nextStartTimeRef.current < curTime) {
            nextStartTimeRef.current = curTime;
          }
          sourceNode.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuf.duration;
        } else if (msg.interrupted) {
          stopActiveAudioPlayback();
          setLiveState("interrupted");
          setTimeout(() => {
            setLiveState("listening");
          }, 200);
        } else if (msg.type === "userTranscript") {
          setUserTranscript((prev) => {
            const next = prev ? prev + " " + msg.text : msg.text;
            userTranscriptRef.current = next;
            return next;
          });
          setLiveState("processing");
        } else if (msg.type === "userFinishedSpeaking") {
          handleSyncTranscriptToChat();
        } else if (msg.type === "modelTranscript") {
          if (userTranscriptRef.current.trim()) {
            handleSyncTranscriptToChat();
          }
          setModelTranscript((prev) => prev + msg.text);
          setChats((prev) => {
            if (prev.length > 0 && prev[prev.length - 1].role === "model") {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                text: last.text + msg.text,
                timestamp: Date.now(),
              };
              return updated;
            } else {
              return [
                ...prev,
                { role: "model", text: msg.text, timestamp: Date.now() },
              ];
            }
          });
        } else if (msg.type === "taskUpdated") {
          // Sync voice action instantly with database & UI components
          triggerToast(`Saarthi Voice Action: ${msg.message}`);
          if (msg.tasks) {
            setTasks(msg.tasks);
            saveLocalTasks(user?.uid || "simulated", msg.tasks);
          }
        }
      } catch (e) {
        console.error("Error decoding WS audio payload:", e);
      }
    };

    ws.onclose = () => {
      if (isLiveActive) {
        setLiveState("disconnected");
        handleStopLiveCall();
      }
    };

    ws.onerror = (err) => {
      console.error("WS transport level fault:", err);
      setLiveState("error");
      setLiveErrorMessage("Live WebSocket connection disrupted.");
      handleStopLiveCall();
    };
  };

  const stopActiveAudioPlayback = () => {
    activeAudioSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeAudioSourcesRef.current = [];
    playbackVolumeRef.current = 0;
    setPlaybackVolume(0);
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  };

  const handleStopLiveCall = () => {
    setIsLiveActive(false);
    setLiveState("idle");
    setMicVolume(0);
    setPlaybackVolume(0);

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (user && conversationDuration > 0) {
      behavioralIntelligenceService.trackEvent({
        userId: user.uid,
        eventType: "VOICE_CONVERSATION",
        durationMinutes: Math.max(1, Math.round(conversationDuration / 60)),
        confidence: 100
      });
    }

    stopActiveAudioPlayback();

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
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
    triggerToast("Saarthi voice session closed.");
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
      <div className="min-h-screen flex flex-col md:flex-row bg-white dark:bg-zinc-950 font-sans overflow-hidden selection:bg-indigo-600 selection:text-white dark:selection:bg-indigo-500">
        {/* Left Side - Visual / Marketing (Hidden on mobile) */}
        <div className="hidden md:flex relative w-1/2 bg-zinc-50 dark:bg-zinc-900 items-center justify-center p-12 overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
          {/* Abstract graphics / Floating elements */}
          <div className="absolute inset-0 z-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[100px] animate-pulse" />
            <div
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-[100px] animate-pulse"
              style={{ animationDelay: "1s" }}
            />
          </div>

          <div className="relative z-10 max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 backdrop-blur-md mb-8 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-widest font-mono">
                Saarthi Platform
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl lg:text-5xl font-bold font-display tracking-tight text-zinc-900 dark:text-white leading-tight mb-6"
            >
              Stop planning.
              <br />
              Start{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-rose-500 dark:from-indigo-400 dark:to-rose-400">
                executing.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-12"
            >
              Traditional tools build reminders, which causes screen fatigue.
              Saarthi targets <strong>actual execution</strong>. Map
              assignments, decompose steps, and manage deadlines with strategic
              intelligence.
            </motion.p>

            {/* Bento grid style visual */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 gap-4"
            >
              <div className="p-5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 backdrop-blur-sm shadow-sm transition-all hover:scale-[1.02]">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Smart Decomp
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  AI breaks down complex tasks into atomic steps.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 backdrop-blur-sm shadow-sm transition-all hover:scale-[1.02]">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-3">
                  <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Live PCM
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Real-time voice bridging for strategic guidance.
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Side - Auth */}
        <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-y-auto min-h-screen z-10 bg-white dark:bg-zinc-950">
          {/* Mobile Header (Hidden on desktop) */}
          <div className="md:hidden w-full flex justify-between items-center mb-10 max-w-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-zinc-900 rounded-xl border border-indigo-100 dark:border-zinc-800">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="font-bold font-display text-zinc-900 dark:text-zinc-100 tracking-tight text-xl">
                Saarthi
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm space-y-8"
          >
            <div className="text-center md:text-left space-y-2.5">
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
                Welcome back
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                Sign in to your execution workspace.
              </p>
            </div>

            {/* Login Options Container */}
            <div className="space-y-5">
              {/* Google Login */}
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 py-3.5 px-6 rounded-xl font-semibold transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-[0.98]"
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
                <span className="text-sm">
                  {isLoggingIn
                    ? "Initializing secure profile..."
                    : "Continue with Google"}
                </span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
                <span className="flex-shrink mx-4 text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider font-mono">
                  Sandbox Mode
                </span>
                <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
              </div>

              {/* Sandbox Access */}
              <button
                onClick={() => {
                  const simUserObj = {
                    uid: "sandbox_sim_luv_sarkari_gmail_com",
                    email: "sandbox@saarthi-platform.com",
                    displayName: "Workspace Owner",
                    photoURL:
                      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
                    isSimulated: true,
                  };
                  setUser(simUserObj as any);
                  localStorage.setItem(
                    "saarthi_current_simulated_user",
                    JSON.stringify(simUserObj),
                  );
                  setNeedsAuth(false);
                  triggerToast(
                    `Premium Workspace profile loaded successfully.`,
                  );
                }}
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 border border-indigo-100/80 dark:border-indigo-900/40 transition-all group cursor-pointer"
              >
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">
                    1-Click Preview Access
                  </span>
                  <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
                    Instantly load a secure workspace profile
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 transition-colors">
                  <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
                </div>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSandboxForm(!showSandboxForm);
                    setSandboxEmail("");
                    setSandboxName("");
                  }}
                  className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors cursor-pointer border-b border-transparent hover:border-zinc-800 dark:hover:border-zinc-300 pb-0.5"
                >
                  {showSandboxForm
                    ? "Hide custom profile setup"
                    : "Or setup a custom sandbox profile"}
                </button>
              </div>
            </div>

            {/* Expandable Sandbox Form */}
            <AnimatePresence>
              {showSandboxForm && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSandboxLogin}
                  className="p-5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-4 overflow-hidden"
                >
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wide">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={sandboxEmail}
                      onChange={(e) => setSandboxEmail(e.target.value)}
                      placeholder="e.g. yourname@example.com"
                      className="w-full text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 outline-none transition-all placeholder-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wide">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={sandboxName}
                      onChange={(e) => setSandboxName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 outline-none transition-all placeholder-zinc-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white py-3 px-4 rounded-xl font-bold text-sm shadow-sm active:scale-[0.98] transition-all cursor-pointer mt-2"
                  >
                    Access Custom Profile
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {loginErrorHint && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-left text-xs text-amber-800 dark:text-amber-400 space-y-3"
              >
                <p className="font-bold flex items-center gap-2 text-amber-900 dark:text-amber-300 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Popup Blocked
                </p>
                <p className="leading-relaxed opacity-90 text-[11px]">
                  Because Saarthi is running inside a secure sandbox preview
                  iframe, your browser may block the sign-in popup. Open in a
                  new tab to sign in via Google.
                </p>
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, "_blank")}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </button>
              </motion.div>
            )}

            <div className="pt-8 w-full">
              <button
                onClick={() => setCurrentView("landing")}
                className="flex items-center gap-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mx-auto"
              >
                ← Back to landing page
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const handleUpdateCompanionProfile = async (
    updates: Partial<CompanionProfile>,
  ) => {
    if (!user) return;

    const updatedProfile = {
      ...companionProfile,
      ...updates,
    } as CompanionProfile;

    if (user.isSimulated) {
      localStorage.setItem(
        "saarthi_companion_profile_" + user.uid,
        JSON.stringify(updatedProfile),
      );
      setCompanionProfile(updatedProfile);
      triggerToast("Companion profile updated.");
      return;
    }

    try {
      const docRef = doc(db, "userSettings", user.uid);
      await setDoc(
        docRef,
        { companionProfile: updatedProfile },
        { merge: true },
      );
      setCompanionProfile(updatedProfile);

      // Also update the server's version for voice/telegram
      await fetch("/api/telegram/sync-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          tasks,
          companionProfile: updatedProfile,
        }),
      });

      triggerToast("Companion profile updated.");
    } catch (err) {
      console.error("Failed to update companion profile:", err);
      triggerToast("Failed to update companion profile.");
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafb] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-sans relative flex flex-col overflow-x-hidden selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-950 transition-all">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.015] dark:opacity-[0.03] mix-blend-overlay z-0"></div>
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-white dark:from-indigo-900/10 dark:via-zinc-950 dark:to-zinc-950 z-0"></div>
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0"></div>

      {/* Toast Notification HUD */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-[100] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 py-3 px-5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 transition-all duration-300 transform animate-in slide-in-from-top-5">
          <Sparkles className="text-zinc-600 dark:text-zinc-400 w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Hidden audio element for TTS playback */}
      <audio ref={audioPlayerRef} style={{ display: "none" }} />

      {/* API Configuration Warning Banner */}
      {user &&
        !SYSTEM_ADMIN_EMAILS.includes(user.email?.toLowerCase() || "") &&
        !userApiKey && (
          <div className="bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-400 px-4 py-2.5 text-center text-xs flex items-center justify-center gap-2 relative z-50 shadow-sm transition-all">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
            <span>
              Logged in as{" "}
              <strong className="font-semibold text-amber-900">
                {user.email}
              </strong>
              . Press <strong>"Configure Key"</strong> to set your private
              Gemini API Key to run Planner integrations.
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

      {/* Floating App Navigation Island (Desktop) */}
      <div className="hidden md:flex fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl pointer-events-none transition-all duration-300">
        <header className="w-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl border border-zinc-200/60 dark:border-zinc-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[24px] px-3 py-2 flex items-center justify-between pointer-events-auto relative">
          {/* Logo */}
          <div className="flex-1 flex justify-start">
            <div
              className="flex items-center gap-3 pl-2 cursor-pointer group"
              onClick={() => setCurrentView("landing")}
            >
              <div className="h-8 w-8 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 shadow-sm transition-transform duration-200 group-hover:scale-105">
                <Sparkles className="w-4 h-4 text-indigo-400 dark:text-indigo-600 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-100 leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Saarthi
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Nav Tabs */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <nav className="flex items-center gap-2 p-1.5">
              {[
                { id: "workspace", label: "Home", icon: Activity },
                { id: "planner", label: "Brain Dump", icon: Plus },
                { id: "tasks", label: "Execution", icon: CheckSquare },
                { id: "engagement", label: "Behavior", icon: BarChart },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentView(tab.id as any)}
                    className={`relative outline-none px-4 py-2 flex items-center gap-2 text-[13px] font-bold rounded-full transition-all cursor-pointer z-10 ${
                      currentView === tab.id
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    {currentView === tab.id && (
                      <motion.div
                        layoutId="desktopNavIndicator"
                        className="absolute inset-0 bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80 rounded-full -z-10"
                      />
                    )}
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex-1 flex justify-end">
            <div className="flex items-center gap-2 pr-1">
              {/* Profile Dropdown */}
              <div className="relative ml-1">
                <button
                  onClick={() => setShowUserDropdown((prev) => !prev)}
                  className="flex items-center justify-center hover:scale-105 transition-transform bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700/80 p-0.5 rounded-full shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
                >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="pfp"
                    className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-900 shadow-sm"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 ring-2 ring-white dark:ring-zinc-900 shadow-sm">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </button>

              {showUserDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserDropdown(false)}
                  ></div>
                  <div className="absolute right-0 mt-3 w-52 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden z-50 flex flex-col p-1.5 animate-in slide-in-from-top-2">
                    <button
                      onClick={() => {
                        setActiveSettingsTab("api");
                        setShowSettingsModal(true);
                        setShowUserDropdown(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors w-full text-left"
                    >
                      <Settings className="w-4 h-4 text-zinc-500" />
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveSettingsTab("memory");
                        setShowSettingsModal(true);
                        setShowUserDropdown(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors w-full text-left"
                    >
                      <Brain className="w-4 h-4 text-zinc-500" />
                      <span>AI Memory</span>
                    </button>

                    <button
                      onClick={() => {
                        setTheme((prev) =>
                          prev === "dark" ? "light" : "dark",
                        );
                        setShowUserDropdown(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors w-full text-left"
                    >
                      {theme === "dark" ? (
                        <>
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span>Theme: Light</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-indigo-500" />
                          <span>Theme: Dark</span>
                        </>
                      )}
                    </button>

                    <div className="h-px bg-zinc-200/80 dark:bg-zinc-800/80 my-1 mx-2" />

                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserDropdown(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </header>
      </div>

      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-zinc-950/80 border-b border-zinc-200/80 dark:border-zinc-800/80 shadow-sm transition-all duration-200 px-5 py-3.5 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setCurrentView("landing")}
        >
          <div className="h-8 w-8 rounded-full bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-white shadow-sm ring-1 ring-zinc-950/5 group-hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Saarthi
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user?.photoURL ? (
            <img
              onClick={() => setShowMobileMoreMenu(true)}
              src={user.photoURL}
              alt="pfp"
              className="w-8 h-8 rounded-full ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-sm"
            />
          ) : (
            <div
              onClick={() => setShowMobileMoreMenu(true)}
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-sm"
            >
              <UserIcon className="w-4 h-4" />
            </div>
          )}
        </div>
      </header>

      {/* Main Single Screen Layout */}
      {/* Increased top padding on md to account for floating header */}
      <main className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 md:pt-28 md:pb-12 flex flex-col gap-4 sm:gap-8 flex-1 pb-[140px] md:pb-[180px] overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          {currentView === "planner" && (
            <motion.div
              key="planner"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
                {/* Section 1: Dual-Input Cognitive Capture Deck */}
                <div className="bg-white dark:bg-zinc-900 border-none sm:border sm:border-zinc-200/80 sm:dark:border-zinc-800/80 rounded-none sm:rounded-2xl p-4 sm:p-6 shadow-none sm:shadow-sm overflow-hidden relative transition-all min-h-[calc(100vh-140px)] sm:min-h-0 flex flex-col">
                  <div className="mb-5 hidden sm:block">
                    <h2 className="text-base font-semibold font-display text-zinc-950 dark:text-zinc-50 mb-1 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                      Brain Dump
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Capture chaotic, unstructured intentions via text, voice, or image. Let
                      Saarthi auto-decompose and structure your timeline.
                    </p>
                  </div>

                  <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 items-stretch">
                    {/* Left Column: Natural text entry */}
                    <div className="lg:col-span-7 flex flex-col justify-between gap-4 flex-1">
                      <div className="space-y-2 flex-1 flex flex-col">
                        <span className="hidden sm:block text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                          1. Unstructured Intention Entry
                        </span>
                        <div className="relative flex-1 min-h-[150px] sm:min-h-[90px]">
                          <textarea
                            value={newCommitment}
                            onChange={(e) => setNewCommitment(e.target.value)}
                            placeholder="Brain dump what you need to accomplish... type, paste, or upload a syllabus..."
                            className="w-full h-full bg-zinc-50/50 sm:bg-zinc-50/50 dark:bg-zinc-950/25 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-300 focus:bg-white dark:focus:bg-zinc-900 rounded-xl sm:rounded-xl p-4 pb-14 sm:pb-4 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none resize-none min-h-[150px] sm:min-h-[90px] transition-all"
                          />
                          <div className="absolute bottom-3 right-3 flex items-center gap-2 sm:hidden">
                            <button className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full text-zinc-500 shadow-sm hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                            </button>
                            <button className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full text-zinc-500 shadow-sm hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                            </button>
                            <button className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full text-zinc-500 shadow-sm hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" onClick={() => navigator.clipboard.readText().then(t => setNewCommitment(prev => prev + t))}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 items-end pb-4 sm:pb-0">
                        <div className="flex-1 w-full">
                          <label className="block text-[10px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400 mb-1.5 font-medium">
                            Target Project Deadline
                          </label>
                          <input
                            type="datetime-local"
                            value={customDeadline}
                            onChange={(e) => setCustomDeadline(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950/25 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-300 focus:bg-white dark:focus:bg-zinc-900 rounded-xl p-3 sm:p-2.5 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 outline-none transition-all"
                          />
                        </div>
                        <button
                          onClick={() => handleAddCommitment()}
                          disabled={isPlanning || !newCommitment.trim()}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 py-4 sm:py-3 px-6 rounded-2xl sm:rounded-xl text-sm sm:text-xs font-bold sm:font-semibold text-white dark:text-zinc-950 transition-all cursor-pointer shadow-sm shrink-0"
                        >
                          {isPlanning ? (
                            <>
                              <RefreshCw className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5 sm:w-4 sm:h-4 text-zinc-300 dark:text-zinc-700" />
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
                  <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row gap-2 sm:items-center">
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-medium uppercase shrink-0">
                      Quick templates:
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar snap-x">
                      <button
                        onClick={() =>
                          loadExampleCommitment(
                            "Physics Lab Assignment on thermal conductivity, due Friday. Need outline, formula spreadsheet, and 12-page write-up completed.",
                          )
                        }
                        className="bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400 text-xs sm:text-[10px] px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-lg transition-colors cursor-pointer shrink-0 snap-start whitespace-nowrap"
                      >
                        Physics Lab Report
                      </button>
                      <button
                        onClick={() =>
                          loadExampleCommitment(
                            "Refactor user database schema, setup firebase firestore indexing, and compile the local dev build on server by Thursday noon.",
                          )
                        }
                        className="bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400 text-xs sm:text-[10px] px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-lg transition-colors cursor-pointer shrink-0 snap-start whitespace-nowrap"
                      >
                        Tech Refactoring
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === "workspace" && (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {(() => {
                const scoredTasks = tasks.map((t) => ({
                  ...t,
                  analysis: computeRiskScore(t),
                }));

                const totalActive = scoredTasks.length;
                const criticalCount = scoredTasks.filter(
                  (t) => t.analysis.zone === "critical",
                ).length;
                const watchCount = scoredTasks.filter(
                  (t) => t.analysis.zone === "watch",
                ).length;
                const recoveryCount = scoredTasks.filter(
                  (t) =>
                    t.analysis.zone === "critical" ||
                    t.analysis.zone === "watch" ||
                    t.recoveryPlan,
                ).length;

                // Mock friction detection: If any task is critical, or just simulate friction for the demo
                // In a real app, this would be triggered by 'untouched for 2 hours', 'rapidly dropping confidence', etc.
                const isFrictionDetected = criticalCount > 0 && !hasDismissedActivationPrompt;

                if (isFrictionDetected) {
                  return (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in px-4">
                      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl border border-rose-100 dark:border-rose-900/50 p-8 sm:p-10 text-center shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
                        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center mb-6">
                          <Zap className="h-8 w-8 sm:h-10 sm:w-10 text-rose-500 animate-pulse" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 mb-3">
                          Activation Engine Triggered
                        </h2>
                        
                        <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl p-4 mb-6 text-left border border-rose-100 dark:border-rose-900/30">
                           <div className="flex items-center gap-2 mb-2">
                             <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                             <span className="text-sm font-bold text-rose-700 dark:text-rose-400">Why am I seeing this?</span>
                           </div>
                           <p className="text-xs text-rose-600/80 dark:text-rose-400/80 leading-relaxed">
                             Saarthi detected high task friction. One of your critical milestones (e.g. "Finish DBMS Assignment") has been untouched for over 2 hours, and timeline pressure is building. 
                           </p>
                        </div>
                        
                        <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm leading-relaxed">
                          Let's bypass the mental barrier and start safely with a guided micro-mission.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => setIsActivationModalOpen(true)}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 sm:py-4 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 group"
                          >
                            Launch Activation Engine
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </button>
                          
                          <button
                            onClick={() => setHasDismissedActivationPrompt(true)}
                            className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold py-3 sm:py-3.5 rounded-xl transition-all cursor-pointer"
                          >
                            Dismiss for now
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                const totalConfidence = scoredTasks.reduce(
                  (sum, t) => sum + t.analysis.completionConfidence,
                  0,
                );
                const avgConfidence =
                  totalActive > 0
                    ? Math.round(totalConfidence / totalActive)
                    : 100;

                const totalSubtasksCount = scoredTasks.reduce(
                  (sum, t) => sum + t.subtasks.length,
                  0,
                );
                const completedSubtasksCount = scoredTasks.reduce(
                  (sum, t) => sum + t.subtasks.filter((s) => s.done).length,
                  0,
                );

                // Find Today's Focus: sort by risk zone severity, score, then deadline proximity
                const sortedForFocus = [...scoredTasks].sort((a, b) => {
                  if (
                    a.analysis.zone === "critical" &&
                    b.analysis.zone !== "critical"
                  )
                    return -1;
                  if (
                    a.analysis.zone !== "critical" &&
                    b.analysis.zone === "critical"
                  )
                    return 1;
                  if (
                    a.analysis.zone === "watch" &&
                    b.analysis.zone !== "watch"
                  )
                    return -1;
                  if (
                    a.analysis.zone !== "watch" &&
                    b.analysis.zone === "watch"
                  )
                    return 1;
                  if (b.analysis.score !== a.analysis.score)
                    return b.analysis.score - a.analysis.score;
                  return (
                    new Date(a.deadline).getTime() -
                    new Date(b.deadline).getTime()
                  );
                });

                const focusTask = sortedForFocus[0];

                // Greetings
                const hour = new Date().getHours();
                let greetingWord = "Good evening";
                if (hour >= 5 && hour < 12) greetingWord = "Good morning";
                else if (hour >= 12 && hour < 17) greetingWord = "Good afternoon";
                else if (hour >= 17 && hour < 22) greetingWord = "Good evening";
                else greetingWord = "Late night";

                const userName = user?.displayName
                  ? user.displayName.split(" ")[0]
                  : user?.email?.split("@")[0] || "Friend";

                // Dynamic recommendations list
                const recommendationsList: Array<{
                  title: string;
                  description: string;
                  actionText: string;
                  icon: any;
                  onClick: () => void;
                }> = [];

                if (focusTask) {
                  const nextSub = focusTask.subtasks.find((s) => !s.done);
                  if (nextSub) {
                    recommendationsList.push({
                      title: "Progress Today's Centerpiece",
                      description: `Complete the milestone "${nextSub.title}" for "${focusTask.title}" next.`,
                      actionText: "Mark complete",
                      icon: CheckSquare,
                      onClick: () => handleToggleSubtask(focusTask, nextSub.id),
                    });
                  }
                }

                const criticalTaskForRec = scoredTasks.find(
                  (t) => t.analysis.zone === "critical",
                );
                if (criticalTaskForRec) {
                  recommendationsList.push({
                    title: "Relieve timeline pressure",
                    description: `Extend "${criticalTaskForRec.title}" buffer by 1 day to secure pacing safety.`,
                    actionText: "Snooze 1 day",
                    icon: Clock,
                    onClick: () => handleSnoozeDeadline(criticalTaskForRec, 1),
                  });
                }

                const missingGuideTask = scoredTasks.find(
                  (t) => !t.reminderContext,
                );
                if (missingGuideTask) {
                  recommendationsList.push({
                    title: "Break down next steps",
                    description: `Formulate milestone guidelines and study resources for "${missingGuideTask.title}".`,
                    actionText: "Generate focus guide",
                    icon: Sparkles,
                    onClick: () => handleGetReminderContext(missingGuideTask),
                  });
                }

                const unsyncedTask = scoredTasks.find(
                  (t) => !t.googleCalendarSynced,
                );
                if (unsyncedTask) {
                  recommendationsList.push({
                    title: "Protect schedule focus",
                    description: `Sync milestone session blocks for "${unsyncedTask.title}" with Google Calendar.`,
                    actionText: "Add to Calendar",
                    icon: Calendar,
                    onClick: () => handleSyncToGoogleCalendar(unsyncedTask),
                  });
                }

                if (!telegramChatId) {
                  recommendationsList.push({
                    title: "Enable remote execution",
                    description: "Connect Telegram to interact with your execution engine via text and voice anywhere.",
                    actionText: "Connect Telegram",
                    icon: MessageSquare,
                    onClick: () => {
                      setActiveSettingsTab("telegram");
                      setShowSettingsModal(true);
                    }
                  });
                }

                recommendationsList.push({
                  title: "Plan another milestone",
                  description:
                    "Map out a new course, capture commitments, or deconstruct a syllabus.",
                  actionText: "Open Planner",
                  icon: FileText,
                  onClick: () => setCurrentView("planner"),
                });

                const activeRecs = recommendationsList.slice(0, 3);

                // Health Indicators
                let healthTitle = "Pacing stabilized";
                let healthDesc =
                  "All your commitments are currently well-buffered and pacing nicely.";
                let healthClass =
                  "text-emerald-800 dark:text-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/15 border-emerald-100/50 dark:border-emerald-900/20";
                if (criticalCount > 0) {
                  healthTitle = "Strategic pace alert";
                  healthDesc = `${criticalCount} commitment(s) require intervention to recover schedule buffer safety.`;
                  healthClass =
                    "text-rose-800 dark:text-rose-500 bg-rose-500/5 dark:bg-rose-950/15 border-rose-100/50 dark:border-rose-900/20";
                } else if (watchCount > 0) {
                  healthTitle = "Review pacing buffers";
                  healthDesc =
                    "Timeline cushions are mostly secure, but some milestones require active watch.";
                  healthClass =
                    "text-amber-800 dark:text-amber-500 bg-amber-500/5 dark:bg-amber-950/15 border-amber-100/50 dark:border-amber-900/20";
                }

                // Chronological Activities
                const recentActivities: Array<{
                  id: string;
                  text: string;
                  timeText: string;
                  icon: any;
                }> = [];

                scoredTasks.forEach((t) => {
                  t.subtasks.forEach((s) => {
                    if (s.done) {
                      recentActivities.push({
                        id: `sub-${s.id}`,
                        text: `Marked milestone "${s.title}" complete for "${t.title}"`,
                        timeText: "Recently",
                        icon: CheckSquare,
                      });
                    }
                  });
                  if (t.googleCalendarSynced) {
                    recentActivities.push({
                      id: `gcal-${t.id}`,
                      text: `Synced session events with Google Calendar for "${t.title}"`,
                      timeText: "Paced",
                      icon: Calendar,
                    });
                  }
                });

                if (recentActivities.length === 0) {
                  recentActivities.push({
                    id: "init",
                    text: "Workspace activated. Ready to capture schedules or analyze documents.",
                    timeText: "Now",
                    icon: Activity,
                  });
                }

                const sortedActivities = recentActivities.slice(0, 3);

                // Empty state handling
                if (tasks.length === 0) {
                  return (
                    <div className="flex flex-col gap-6 max-w-2xl mx-auto py-16 text-center animate-fade-in">
                      <div className="relative w-40 h-40 mx-auto mb-4">
                        {/* Abstract shapes / delightful composition */}
                        <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-950/20 rounded-full animate-pulse" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-900/40 rounded-full shadow-md flex items-center justify-center z-10">
                          <Calendar className="w-12 h-12 text-indigo-400 dark:text-indigo-500" />
                        </div>
                        <motion.div
                          initial={{ scale: 0, y: 20 }}
                          animate={{ scale: 1, y: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            delay: 0.1,
                          }}
                          className="absolute -top-3 -right-2 w-12 h-12 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 rounded-xl flex items-center justify-center shadow-sm rotate-12 z-20"
                        >
                          <Sparkles className="w-5 h-5 text-rose-500" />
                        </motion.div>
                        <motion.div
                          initial={{ scale: 0, y: -20 }}
                          animate={{ scale: 1, y: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            delay: 0.2,
                          }}
                          className="absolute -bottom-1 -left-3 w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-full flex items-center justify-center shadow-sm -rotate-12 z-20"
                        >
                          <CheckSquare className="w-6 h-6 text-emerald-500" />
                        </motion.div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-display">
                          Your canvas is clear
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                          You have no active commitments. Take a breath,
                          appreciate your headway, or map out your next
                          milestone below.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto mt-6">
                        <button
                          onClick={() => setCurrentView("planner")}
                          className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-xs group cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-zinc-500 mb-2 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
                          <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            Map out a commitment
                          </h3>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Capture goals or schedule deadlines
                          </p>
                        </button>

                        <button
                          onClick={() => {
                            loadExampleCommitment(
                              "Physics Lab Assignment on thermal conductivity, due Friday. Need outline, formula spreadsheet, and 12-page write-up completed.",
                            );
                          }}
                          className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-xs group cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-zinc-500 mb-2 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 animate-pulse" />
                          <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-sans">
                            Try an academic draft
                          </h3>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Let AI build a sample Physics lab outline
                          </p>
                        </button>
                      </div>
                    </div>
                  );
                }

                const incompleteSorted = scoredTasks
                  .filter((t) => !t.isCompleted)
                  .sort((a, b) => {
                    const diff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                    if (diff !== 0) return diff;
                    return a.id.localeCompare(b.id);
                  });
                const nextDeadlines = incompleteSorted.slice(0, 2);

                return (
                  <div className="flex flex-col gap-5 sm:gap-8 w-full max-w-5xl mx-auto py-1 sm:py-2 animate-fade-in">
                    {/* 1. Greeting Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5 sm:space-y-1">
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                          {greetingWord}, {userName}
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] sm:text-xs">
                          Your active execution engine for managing behavior and securing completion.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsAdaptiveModalOpen(true)}
                          className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Adaptive Planning Engine
                        </button>
                      </div>
                    </div>

                    {/* 2. Today's Focus (Emotional Centerpiece) */}
                    {focusTask &&
                      (() => {
                        const hoursRemaining = getHoursRemaining(
                          focusTask.deadline,
                        );
                        const incompleteSubtasks = focusTask.subtasks.filter(
                          (s) => !s.done,
                        );
                        const estimatedFocusTime = incompleteSubtasks.reduce(
                          (sum, s) => sum + s.estimatedMinutes,
                          0,
                        );
                        const nextSubtask = focusTask.subtasks.find(
                          (s) => !s.done,
                        );

                        return (
                          <div className="relative border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 rounded-[20px] sm:rounded-2xl p-4 sm:p-6 shadow-xs overflow-hidden flex flex-col gap-3 sm:gap-4.5">
                            {/* Background accent line indicating risk state */}
                            <div
                              className={`absolute top-0 left-0 h-full w-1.5 ${
                                focusTask.riskZone === "critical"
                                  ? "bg-rose-500"
                                  : focusTask.riskZone === "watch"
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                            />

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                              <div className="space-y-1 sm:space-y-1.5">
                                <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                                  Today's primary commitment
                                </span>
                                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 font-sans">
                                  {focusTask.title}
                                </h2>
                                <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed hidden sm:block">
                                  Because{" "}
                                  {focusTask.analysis.explanation.primaryReason.toLowerCase()}{" "}
                                  which constrains your pacing safety cushion.
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold sm:font-medium border ${
                                    focusTask.riskZone === "critical"
                                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-500 border-rose-100"
                                      : focusTask.riskZone === "watch"
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-500 border-amber-100"
                                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-500 border-emerald-100"
                                  }`}
                                >
                                  {focusTask.riskZone === "critical"
                                    ? "Action advised"
                                    : focusTask.riskZone === "watch"
                                      ? "Pacing watched"
                                      : "Fully secure"}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 sm:gap-4 py-1 sm:py-1.5">
                              <div className="p-2 sm:p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-xl bg-white dark:bg-zinc-900/60 shadow-xxs flex flex-col justify-center">
                                <span className="text-[9px] sm:text-[10px] font-medium text-zinc-400 dark:text-zinc-500 block truncate">
                                  Buffer
                                </span>
                                <span className="text-xs sm:text-sm font-bold sm:font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5 sm:mt-1 block flex items-center gap-1">
                                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-400" />
                                  {formatTimeRemaining(hoursRemaining)}
                                </span>
                              </div>

                              <div className="p-2 sm:p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-xl bg-white dark:bg-zinc-900/60 shadow-xxs flex flex-col justify-center">
                                <span className="text-[9px] sm:text-[10px] font-medium text-zinc-400 dark:text-zinc-500 block truncate">
                                  Confidence
                                </span>
                                <span className="text-xs sm:text-sm font-bold sm:font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5 sm:mt-1 block flex items-center gap-1">
                                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-400" />
                                  {focusTask.analysis.completionConfidence}%
                                </span>
                              </div>

                              <div className="p-2 sm:p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-xl bg-white dark:bg-zinc-900/60 shadow-xxs flex flex-col justify-center">
                                <span className="text-[9px] sm:text-[10px] font-medium text-zinc-400 dark:text-zinc-500 block truncate">
                                  Time
                                </span>
                                <span className="text-xs sm:text-sm font-bold sm:font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5 sm:mt-1 block flex items-center gap-1">
                                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-400" />
                                  {estimatedFocusTime}m
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-1 sm:pt-2">
                              {nextSubtask ? (
                                <button
                                  onClick={() =>
                                    handleToggleSubtask(
                                      focusTask,
                                      nextSubtask.id,
                                    )
                                  }
                                  className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-bold sm:font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <CheckSquare className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                  <span className="truncate">
                                    Next: {nextSubtask.title}
                                  </span>
                                </button>
                              ) : (
                                <div className="text-xs text-zinc-500 font-medium">
                                  🎉 Excellent pacing! You've successfully
                                  completed all active milestones.
                                </div>
                              )}

                              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                                <button
                                  onClick={() => {
                                    setExpandedTaskId(
                                      expandedTaskId === focusTask.id
                                        ? null
                                        : focusTask.id,
                                    );
                                  }}
                                  className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-[11px] sm:text-xs font-bold sm:font-medium border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300 cursor-pointer"
                                >
                                  {expandedTaskId === focusTask.id
                                    ? "Close tracker"
                                    : "View tracker"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                    {/* Secondary Analytics (Expandable on Mobile) */}
                    <details className="group border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
                      <summary className="px-4 py-3 sm:hidden text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer outline-none select-none">
                        View pacing analytics
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-open:-rotate-180 transition-transform" />
                      </summary>
                      
                      <div className="hidden sm:grid sm:grid-cols-1 md:grid-cols-3 gap-4 group-open:grid grid-cols-1 p-4 sm:p-0">
                        {/* Health banner */}
                        <div
                          className={`md:col-span-3 border p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xxs ${healthClass}`}
                        >
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                              Overall pacing health
                            </span>
                            <h3 className="text-sm font-semibold font-sans">
                              {healthTitle}
                            </h3>
                            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                              {healthDesc}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-zinc-400 font-medium block">
                                Execution Confidence
                              </span>
                              <span className="text-lg font-bold font-sans">
                                {avgConfidence}%
                              </span>
                            </div>
                            <div className="w-1.5 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`w-full h-full ${
                                  avgConfidence >= 75
                                    ? "bg-emerald-500"
                                    : avgConfidence >= 45
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Quick Summary Cards */}
                        <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/60 shadow-xxs text-center">
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                            Focus commitments
                          </span>
                          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1 block font-sans">
                            {totalActive}
                          </span>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            Currently being managed
                          </p>
                        </div>

                        <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/60 shadow-xxs text-center">
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                            Met milestones
                          </span>
                          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1 block font-sans">
                            {completedSubtasksCount}{" "}
                            <span className="text-sm text-zinc-400 font-normal">
                              of {totalSubtasksCount}
                            </span>
                          </span>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            Subtask pacing progress
                          </p>
                        </div>

                        <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/60 shadow-xxs text-center">
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                            Recovery OS Active
                          </span>
                          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1 block font-sans">
                            {recoveryCount}
                          </span>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            Active rescue plans
                          </p>
                        </div>
                      </div>
                    </details>

                    {/* 5. Upcoming Deadlines Section */}
                    {nextDeadlines.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                          Upcoming deadlines
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {nextDeadlines.map((t) => {
                            const hrs = getHoursRemaining(t.deadline);
                            const comp = t.subtasks.filter(
                              (s) => s.done,
                            ).length;
                            const tot = t.subtasks.length;
                            const progressPct =
                              tot > 0 ? Math.round((comp / tot) * 100) : 0;
                            return (
                              <div
                                key={t.id}
                                className="p-3.5 border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-between gap-4 text-xs transition-all shadow-xxs"
                              >
                                <div className="truncate flex-1 min-w-0">
                                  <span className="font-semibold text-zinc-800 dark:text-zinc-50 block truncate">
                                    {t.title}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 block flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-zinc-400" />
                                    {formatTimeRemaining(hrs)} remaining ·{" "}
                                    {progressPct}% resolved
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg shrink-0 ${
                                    t.analysis.zone === "critical"
                                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100"
                                      : "bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200"
                                  }`}
                                >
                                  {t.analysis.completionConfidence}% confident
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 6. AI Recommendations (First-class Feature) */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                          AI Recommendations
                        </h3>
                        <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 border border-indigo-100/40 rounded-md font-bold uppercase tracking-wider scale-95">
                          Actionable advice
                        </span>
                      </div>

                      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-xxs">
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {activeRecs.map((rec, idx) => {
                            const RecIcon = rec.icon;
                            return (
                              <div
                                key={idx}
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shrink-0 text-zinc-500">
                                    <RecIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                  </span>
                                  <div className="space-y-0.5">
                                    <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                                      {rec.title}
                                    </h4>
                                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                                      {rec.description}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  onClick={rec.onClick}
                                  className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                                >
                                  {rec.actionText}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* 7. Active Tasks List */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                          All Commitments ({tasks.length})
                        </h3>
                        <div
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                          onClick={() => setCurrentView("tasks")}
                        >
                          <span>Full list view</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...scoredTasks]
                          .filter(t => !t.isCompleted)
                          .sort((a, b) => {
                            const diff = b.analysis.score - a.analysis.score;
                            if (diff !== 0) return diff;
                            return a.id.localeCompare(b.id);
                          })
                          .map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onToggleSubtask={handleToggleSubtask}
                              onDeleteTask={handleDeleteTask}
                              onUpdateTask={handleUpdateTask}
                              onGenerateRescuePlan={handleGenerateRescuePlan}
                              onGetReminderContext={handleGetReminderContext}
                              onSyncGoogleCalendar={handleSyncToGoogleCalendar}
                              onSnoozeDeadline={handleSnoozeDeadline}
                              isGeneratingContext={
                                generatingContextTaskId === task.id
                              }
                              expandedSubtask={expandedTaskId === task.id}
                              onToggleExpandSubtask={() =>
                                setExpandedTaskId(
                                  expandedTaskId === task.id ? null : task.id,
                                )
                              }
                              expandedReminder={
                                expandedReminderTaskId === task.id
                              }
                              onToggleExpandReminder={() =>
                                setExpandedReminderTaskId(
                                  expandedReminderTaskId === task.id
                                    ? null
                                    : task.id,
                                )
                              }
                              accessToken={accessToken}
                            />
                          ))}
                      </div>
                    </div>

                    {/* 8. Recovery Center (Shown ONLY if necessary) */}
                    {tasks.some(
                      (t) =>
                        t.riskZone === "critical" ||
                        t.riskZone === "watch" ||
                        t.recoveryPlan,
                    ) && (
                      <div className="border border-amber-200/50 dark:border-amber-900/30 bg-amber-500/5 dark:bg-amber-950/10 p-5 rounded-2xl space-y-4 shadow-xxs">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-lg">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                              Recovery OS
                            </h3>
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              Calm tactical support & pacing compromise
                              recommendations
                            </p>
                          </div>
                        </div>

                        <div className="divide-y divide-amber-200/30 dark:divide-amber-800/20">
                          {scoredTasks
                            .filter(
                              (t) =>
                                t.analysis.zone === "critical" ||
                                t.analysis.zone === "watch" ||
                                t.recoveryPlan,
                            )
                            .map((t) => {
                              const hrs = getHoursRemaining(t.deadline);
                              return (
                                <div
                                  key={t.id}
                                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between gap-4"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span
                                        className={`w-2 h-2 rounded-full ${t.analysis.zone === "critical" ? "bg-rose-500 animate-ping" : "bg-amber-500"}`}
                                      />
                                      <span className="font-semibold text-zinc-800 dark:text-zinc-50">
                                        {t.title}
                                      </span>
                                      <span className="text-zinc-400 dark:text-zinc-500 font-medium">
                                        ({formatTimeRemaining(hrs)} remaining)
                                      </span>
                                    </div>

                                    {t.recoveryPlan ? (
                                      <div className="space-y-1.5 text-[11px] mt-2 bg-amber-500/5 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200/25">
                                        <p className="font-semibold text-amber-950 dark:text-amber-200">
                                          💡 {t.recoveryPlan.messageToUser}
                                        </p>
                                        <p className="text-zinc-600 dark:text-zinc-400">
                                          {t.recoveryPlan.advice}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                                        Your pacing is beginning to push
                                        boundaries. We recommend formulating an
                                        alternative pacing blueprint to
                                        safeguard completion.
                                      </p>
                                    )}
                                  </div>

                                  <div className="shrink-0 self-start md:self-center">
                                    {!t.recoveryPlan && (
                                      <button
                                        onClick={() =>
                                          handleGenerateRescuePlan(t)
                                        }
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-lg shadow-xxs transition-colors cursor-pointer"
                                      >
                                        Rescue pacing
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* 9. Overall Progress Tracker */}
                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                        Milestone pacing progress
                      </h3>
                      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-xxs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="space-y-1 flex-1">
                          <div className="flex justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                            <span>Completed sprints & milestones</span>
                            <span>
                              {completedSubtasksCount} / {totalSubtasksCount}
                            </span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-zinc-800 dark:bg-zinc-200 transition-all duration-500"
                              style={{
                                width: `${totalSubtasksCount > 0 ? (completedSubtasksCount / totalSubtasksCount) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="sm:text-right shrink-0">
                          <span className="text-[10px] text-zinc-400 font-medium block">
                            Decomposing accuracy
                          </span>
                          <span className="text-base font-bold text-zinc-800 dark:text-zinc-100 block font-mono">
                            {totalSubtasksCount > 0
                              ? Math.round(
                                  (completedSubtasksCount /
                                    totalSubtasksCount) *
                                    100,
                                )
                              : 100}
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 10. Quiet Activity Feed */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                        Recent activities
                      </h3>
                      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-4.5 shadow-xxs space-y-3">
                        {sortedActivities.map((act, index) => {
                          const ActIcon = act.icon;
                          return (
                            <div
                              key={act.id}
                              className="flex items-center justify-between gap-4 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="p-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md">
                                  <ActIcon className="w-3.5 h-3.5 text-zinc-500" />
                                </span>
                                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                                  {act.text}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                                {act.timeText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {currentView === "engagement" && (
            <motion.div
              key="engagement"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full flex-grow flex"
            >
              <div className="w-full bg-white dark:bg-zinc-950 p-6 md:p-10 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 relative overflow-hidden flex flex-col min-h-full mx-4 md:mx-0">
                <EngagementInsights 
                  userId={user.uid} 
                  onNavigateToBrain={() => {
                    setActiveSettingsTab("memory");
                    setShowSettingsModal(true);
                  }}
                />
              </div>
            </motion.div>
          )}



          {currentView === "tasks" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold font-display text-zinc-950 dark:text-zinc-50">
                        Execution Overview
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Your full list of commitments and progress.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                    <button
                      onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${showCompletedTasks ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"}`}
                    >
                      {showCompletedTasks ? "Hide Completed" : "Show Completed"}
                    </button>
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search tasks..."
                        value={tasksSearchQuery}
                        onChange={(e) => setTasksSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                      />
                    </div>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setIsTasksSortDropdownOpen(!isTasksSortDropdownOpen)
                        }
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm min-w-[140px]"
                      >
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {tasksSortBy === "created"
                            ? "Created Date"
                            : tasksSortBy === "deadline"
                              ? "Deadline"
                              : "Risk Score"}
                        </span>
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      </button>
                      {isTasksSortDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsTasksSortDropdownOpen(false)}
                          ></div>
                          <div className="absolute right-0 mt-1 w-[140px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-20 py-1 overflow-hidden font-medium">
                            <button
                              onClick={() => {
                                setTasksSortBy("created");
                                setIsTasksSortDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${tasksSortBy === "created" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                            >
                              Created Date
                            </button>
                            <button
                              onClick={() => {
                                setTasksSortBy("deadline");
                                setIsTasksSortDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${tasksSortBy === "deadline" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                            >
                              Deadline
                            </button>
                            <button
                              onClick={() => {
                                setTasksSortBy("risk");
                                setIsTasksSortDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${tasksSortBy === "risk" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10" : "text-zinc-700 dark:text-zinc-300"}`}
                            >
                              Risk Score
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Label Filters */}
                {(() => {
                  const allLabels = Array.from(
                    new Set(tasks.flatMap((t) => t.labels || [])),
                  );
                  if (allLabels.length === 0) return null;

                  return (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mr-2">
                        Filter by:
                      </span>
                      {allLabels.map((lbl) => (
                        <button
                          key={lbl}
                          onClick={() => {
                            if (selectedLabels.includes(lbl)) {
                              setSelectedLabels(
                                selectedLabels.filter((l) => l !== lbl),
                              );
                            } else {
                              setSelectedLabels([...selectedLabels, lbl]);
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            selectedLabels.includes(lbl)
                              ? "bg-indigo-500 text-white dark:bg-indigo-600 shadow-sm"
                              : "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                      {selectedLabels.length > 0 && (
                        <button
                          onClick={() => setSelectedLabels([])}
                          className="px-3 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  );
                })()}

                {tasks.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 shadow-sm text-center flex flex-col items-center justify-center gap-6 mt-8">
                    <div className="relative w-40 h-40 mx-auto">
                      <div className="absolute inset-0 bg-emerald-50 dark:bg-emerald-950/20 rounded-full animate-pulse" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900/40 rounded-full shadow-md flex items-center justify-center z-10">
                        <CheckSquare className="w-12 h-12 text-emerald-500" />
                      </div>
                      <motion.div
                        initial={{ scale: 0, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 15,
                          delay: 0.1,
                        }}
                        className="absolute -top-3 -right-2 w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-center shadow-sm rotate-12 z-20"
                      >
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                      </motion.div>
                    </div>
                    <div className="space-y-2 max-w-sm mx-auto">
                      <h3 className="text-2xl font-bold font-display text-zinc-950 dark:text-zinc-50">
                        All caught up!
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        You have no active commitments right now. Enjoy your
                        free time or start planning your next milestone.
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentView("planner")}
                      className="mt-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-bold rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group"
                    >
                      <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                      Create New Task
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-6">
                    {tasks
                      .filter((task) => {
                        if (!showCompletedTasks && task.isCompleted) return false;
                        const matchesSearch =
                          !tasksSearchQuery ||
                          task.title
                            .toLowerCase()
                            .includes(tasksSearchQuery.toLowerCase()) ||
                          task.description
                            .toLowerCase()
                            .includes(tasksSearchQuery.toLowerCase());
                        const matchesLabels =
                          selectedLabels.length === 0 ||
                          selectedLabels.every((lbl) =>
                            task.labels?.includes(lbl),
                          );
                        return matchesSearch && matchesLabels;
                      })
                      .sort((a, b) => {
                        if (tasksSortBy === "deadline") {
                          const diff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                          if (diff !== 0) return diff;
                          return a.id.localeCompare(b.id);
                        } else if (tasksSortBy === "risk") {
                          const diff = b.riskScore - a.riskScore;
                          if (diff !== 0) return diff;
                          return a.id.localeCompare(b.id);
                        } else {
                          const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                          if (diff !== 0) return diff;
                          return a.id.localeCompare(b.id);
                        }
                      })
                      .map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggleSubtask={handleToggleSubtask}
                          onDeleteTask={handleDeleteTask}
                          onUpdateTask={handleUpdateTask}
                          onGenerateRescuePlan={handleGenerateRescuePlan}
                          onGetReminderContext={handleGetReminderContext}
                          onSyncGoogleCalendar={handleSyncToGoogleCalendar}
                          onSnoozeDeadline={handleSnoozeDeadline}
                          isGeneratingContext={
                            generatingContextTaskId === task.id
                          }
                          expandedSubtask={expandedTaskId === task.id}
                          onToggleExpandSubtask={() =>
                            setExpandedTaskId(
                              expandedTaskId === task.id ? null : task.id,
                            )
                          }
                          expandedReminder={expandedReminderTaskId === task.id}
                          onToggleExpandReminder={() =>
                            setExpandedReminderTaskId(
                              expandedReminderTaskId === task.id
                                ? null
                                : task.id,
                            )
                          }
                          accessToken={accessToken}
                        />
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Nav Floating Dock (Ultra-modern Capsule) */}
      {currentView !== "landing" && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-[60] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl p-1.5 rounded-[32px] border border-zinc-200/50 dark:border-zinc-800/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-between gap-1">
          {[
            { id: "workspace", icon: Activity, label: "Home" },
            { id: "tasks", icon: CheckSquare, label: "Execution" },
            { id: "planner", icon: Plus, label: "Brain Dump" },
            { id: "engagement", icon: BarChart, label: "Behavior" },
            { id: "more", icon: Menu, label: "More" },
          ].map((tab) => {
            const isActive = tab.id !== "more" ? currentView === tab.id : false;
            const Icon = tab.icon;
            
            const handleClick = () => {
              if (tab.id === "more") {
                setShowMobileMoreMenu(true);
              } else {
                setCurrentView(tab.id as any);
              }
            };

            return (
              <button
                key={tab.id}
                onClick={handleClick}
                className={`relative flex-1 h-14 flex flex-col items-center justify-center rounded-[24px] transition-all outline-none focus:outline-none ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute inset-0 bg-white dark:bg-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-zinc-200/40 dark:border-zinc-700/60 rounded-[24px] -z-10"
                  />
                )}
                <Icon
                  className={`w-5 h-5 mb-1 transition-transform ${isActive ? "scale-110" : ""}`}
                />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Floating Copilot Widget */}
      {currentView !== "landing" && (
        <div className="fixed bottom-[96px] md:bottom-8 right-4 md:right-6 z-[70] flex flex-col items-end gap-4 pointer-events-none">
          {isCopilotOpen && (
            <div className="w-[380px] max-w-[calc(100vw-32px)] h-[600px] max-h-[calc(100vh-140px)] md:max-h-[70vh] flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] relative overflow-hidden transition-all animate-in zoom-in-95 pointer-events-auto origin-bottom-right">
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
                liveState={liveState}
                liveErrorMessage={liveErrorMessage}
                userTranscript={userTranscript}
                modelTranscript={modelTranscript}
                micVolume={micVolume}
                playbackVolume={playbackVolume}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
                latencyMs={latencyMs}
                connectionQuality={connectionQuality}
                conversationDuration={conversationDuration}
                availableMics={availableMics}
                availableSpeakers={availableSpeakers}
                selectedMicId={selectedMicId}
                selectedSpeakerId={selectedSpeakerId}
                onSelectMic={handleSelectMic}
                onSelectSpeaker={handleSelectSpeaker}
              />
            </div>
          )}
          <button
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
            className={`md:h-12 md:w-auto md:px-5 h-12 px-4 rounded-full shadow-lg backdrop-blur-xl transition-all flex items-center justify-center gap-2.5 pointer-events-auto group overflow-hidden border ${
              isCopilotOpen
                ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border-zinc-300/50 dark:border-zinc-700/50 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200 shadow-xl hover:scale-105 active:scale-95"
            }`}
          >
            {isCopilotOpen ? (
              <X className="w-5 h-5 transition-transform group-hover:rotate-90 shrink-0" />
            ) : (
              <>
                <div className="relative flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white dark:text-zinc-900 relative z-10 transition-transform group-hover:scale-110" />
                </div>
                <span className="font-bold tracking-tight text-sm text-white dark:text-zinc-900">
                  Saarthi AI
                </span>
              </>
            )}
          </button>
        </div>
      )}

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
        telegramAlertsEnabled={telegramAlertsEnabled}
        telegramAlertSlots={telegramAlertSlots}
        onSaveTelegramAlertSettings={handleSaveTelegramSettings}
        companionProfile={companionProfile}
        onUpdateCompanionProfile={handleUpdateCompanionProfile}
        userId={user?.uid || null}
        onRecovered={() => {
          triggerToast("Recovery successful. Your schedule has been updated.");
          setShowSettingsModal(false);
        }}
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

      {/* Activation Engine Modal */}
      <AnimatePresence>
        {isActivationModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative"
            >
              <button
                onClick={() => setIsActivationModalOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-800 rounded-full backdrop-blur-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex-1 overflow-y-auto">
                <ActivationCenter
                  userId={user?.uid || ""}
                  companionProfile={companionProfile}
                  onExit={() => {
                    setHasDismissedActivationPrompt(true);
                    setIsActivationModalOpen(false);
                  }}
                  tasks={tasks}
                  onToggleSubtask={handleToggleSubtask}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adaptive Planning Modal */}
      <AnimatePresence>
        {isAdaptiveModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative"
            >
              <button
                onClick={() => setIsAdaptiveModalOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-800 rounded-full backdrop-blur-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex-1 overflow-y-auto">
                <AdaptivePlanningCenter
                  userId={user?.uid || ""}
                  tasks={tasks}
                  learningProfile={null}
                  onPlanGenerated={(updatedTasks) => {
                    // Update all tasks with new subtasks/dates
                    updatedTasks.forEach((t) => {
                      handleUpdateTask(t.id, { subtasks: t.subtasks });
                    });
                    triggerToast("Schedule optimally regenerated based on behavior.");
                    setIsAdaptiveModalOpen(false);
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showOnboarding && user && (
        <CompanionOnboarding
          userId={user.uid}
          onComplete={async (profile) => {
            await handleUpdateCompanionProfile(profile);
            setShowOnboarding(false);
          }}
        />
      )}

      {/* Mobile More Menu (Bottom Sheet) */}
      <AnimatePresence>
        {showMobileMoreMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMoreMenu(false)}
              className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[80] md:hidden backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[90] bg-white dark:bg-zinc-950 rounded-t-3xl border-t border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl md:hidden overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex-shrink-0 flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
              </div>
              
              <div className="px-6 pb-4 flex items-center gap-3">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="pfp"
                    className="w-12 h-12 rounded-full ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-sm">
                    <UserIcon className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{user?.displayName || "Warrior"}</h3>
                  <p className="text-xs text-zinc-500">{user?.email}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2">
                {[
                  { id: "settings", icon: Settings, label: "Settings", desc: "App & AI Configuration", onClick: () => {
                    setActiveSettingsTab("api");
                    setShowSettingsModal(true);
                    setShowMobileMoreMenu(false);
                  } },
                  { id: "theme", icon: theme === "dark" ? Sun : Moon, label: "Theme", desc: "Toggle visual style", onClick: () => {
                    setTheme((prev) => prev === "dark" ? "light" : "dark");
                    setShowMobileMoreMenu(false);
                  } },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                      <item.icon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{item.label}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => {
                    handleLogout();
                    setShowMobileMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-left mt-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                    <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="font-bold text-red-600 dark:text-red-400">Sign Out</div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
