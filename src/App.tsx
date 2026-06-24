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
  X
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

const SYSTEM_ADMIN_EMAILS = [
  "luv.sarkari@gmail.com",
  "admin@saarthi-platform.com",
  "sandbox_sim_luv_sarkari_gmail_com",
  "sandbox@saarthi-platform.com"
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentView, setCurrentView] = useState<"landing" | "workspace">("landing");

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
        if (data && data.geminiApiKey) {
          const key = data.geminiApiKey;
          setUserApiKey(key);
          setSettingsKeyInput(key);
          localStorage.setItem("saarthi_gemini_api_key_" + user.uid, key);
        }
      }
    }, (error) => {
      console.warn("Could not read user settings from Firestore:", error);
    });

    return () => unsubscribe();
  }, [user]);

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
        throw new Error("Failed to reach Saarthi task decomposition model.");
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
        const localTasks = [...tasks, { ...newTaskObj, id, riskScore: 0, riskZone: "low" as const }];
        setTasks(localTasks);
        saveLocalTasks(user!.uid, localTasks);
      } else {
        try {
          await addDoc(collection(db, "tasks"), newTaskObj);
        } catch (dbErr: any) {
          console.warn("Firestore addDoc failed, using local storage fallback:", dbErr);
          const id = "local_task_" + Date.now();
          const localTasks = [...tasks, { ...newTaskObj, id, riskScore: 0, riskZone: "low" as const }];
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
        throw new Error("Syllabus extract engine failed.");
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
        throw new Error("Gemini OCR engine failed.");
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
          throw new Error(`Failed to decompose "${item.title}".`);
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
            const updated = [...prev, { ...newTaskObj, id, riskScore: 0, riskZone: "low" as const }];
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
              const updated = [...prev, { ...newTaskObj, id, riskScore: 0, riskZone: "low" as const }];
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
    const updatedSubtasks = task.subtasks.map((s) => {
      if (s.id === subtaskId) {
        return { ...s, done: !s.done };
      }
      return s;
    });

    const sessionsCompleted = updatedSubtasks.filter((s) => s.done).length;

    // Fast-update local React state and save to local storage
    const updatedTasks = tasks.map((t) => {
      if (t.id === task.id) {
        return { ...t, subtasks: updatedSubtasks, sessionsCompleted };
      }
      return t;
    });
    setTasks(updatedTasks);
    saveLocalTasks(user!.uid, updatedTasks);

    if (user!.isSimulated) {
      triggerToast("Execution state synchronized locally.");
      return;
    }

    try {
      const docRef = doc(db, "tasks", task.id);
      await updateDoc(docRef, {
        subtasks: updatedSubtasks,
        sessionsCompleted: sessionsCompleted,
      });
      triggerToast("Execution state synchronized.");
    } catch (err: any) {
      console.warn("Firestore sync failed, local list updated:", err);
      triggerToast("Local task updated (cloud sync pending).");
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

      if (!res.ok) throw new Error("Rescue generation failed.");
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

  // Delete task commitment
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Ensure confirmation from user: Do you really wish to clear this task?")) return;
    
    // Fast local state update
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(updatedTasks);
    saveLocalTasks(user!.uid, updatedTasks);

    if (user!.isSimulated) {
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
        throw new Error("Unable to compile contextual reminder advice.");
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
        throw new Error("Chat bot communication error.");
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

      if (!res.ok) throw new Error("TTS voice engine failed.");

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

      if (!res.ok) throw new Error("Image compiler error.");

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
      <div className="min-h-screen bg-gradient-to-tr from-slate-50 to-indigo-50/40 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
        {/* Glow ambient decors */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500 opacity-[0.08] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[450px] h-[450px] rounded-full bg-pink-500 opacity-[0.05] blur-[100px] pointer-events-none" />

        <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-3xl p-8 md:p-10 shadow-xl shadow-slate-100 relative z-10 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-indigo-50 rounded-2xl mb-6">
            <Sparkles className="w-10 h-10 text-indigo-600" />
          </div>

          <h1 className="text-3xl font-bold font-display tracking-tight text-slate-900 mb-1">
            Saarthi
          </h1>
          <p className="text-xs font-mono tracking-wider text-indigo-600 uppercase mb-5 font-semibold">
            AI Execution Partner
          </p>

          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            Traditional tools build reminders, which causes screen fatigue. Saarthi targets <strong>actual execution</strong>. Map assignments, decompose steps, and manage deadlines with strategic intelligence.
          </p>

          {/* Safe Mode Sandbox Pre-arranged Quick-Access Widget */}
          <div className="mb-6 p-4.5 bg-indigo-50/60 border border-indigo-100/80 rounded-2xl text-left space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span className="text-xs font-bold text-slate-800 tracking-tight">AI Studio Preview - 1-Click Access</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
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
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-medium uppercase tracking-wider font-mono">or connect via services</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Correct style-compliant Google Sign-In Button */}
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 border border-slate-200 py-3.5 px-6 rounded-xl font-semibold hover:bg-slate-50 focus:outline-none transition-all cursor-pointer shadow-sm hover:scale-[1.01]"
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
            <span className="text-slate-800 font-semibold text-xs">
              {isLoggingIn ? "Initializing secure profile..." : "Sign in with Google"}
            </span>
          </button>

          {loginErrorHint && (
            <div className="mt-4 p-3.5 bg-red-50 border border-red-100 rounded-xl text-left text-xs text-red-600 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Auth Popup Restriction Detected
              </p>
              <p className="opacity-90 leading-tight font-mono text-[9px] break-all bg-red-100/30 p-1.5 rounded border border-red-100/50">
                {loginErrorHint}
              </p>
              <p className="opacity-90 leading-normal pt-1 text-[11px]">
                Google API popups might be restricted due to cross-origin isolation. Please use the <strong>Sandbox quick access widget above</strong> to work with your checklist instantly!
              </p>
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
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-slate-50 border border-slate-200/50 py-2 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                Or custom Sandbox Profile name setup →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSandboxLogin} className="mt-5 p-4.5 bg-slate-50 border border-slate-200/60 rounded-2xl text-left space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Custom Profile Access</h3>
                <button
                  type="button"
                  onClick={() => setShowSandboxForm(false)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer uppercase font-bold"
                >
                  Close
                </button>
              </div>

              <div>
                <label className="block text-[9px] font-mono tracking-wider uppercase text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={sandboxEmail}
                  onChange={(e) => setSandboxEmail(e.target.value)}
                  placeholder="e.g. yourname@example.com"
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-sans"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono tracking-wider uppercase text-slate-400 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={sandboxName}
                  onChange={(e) => setSandboxName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-800 text-white hover:bg-slate-900 py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer text-center"
              >
                Access Custom Profile
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-6">
            <div className="text-center">
              <p className="text-xs font-mono font-bold text-emerald-600">Firestore</p>
              <p className="text-[10px] text-slate-400">Durable Cloud</p>
            </div>
            <div className="border-r border-slate-100 h-6 my-auto" />
            <div className="text-center">
              <p className="text-xs font-mono font-bold text-indigo-600">G-Workspace</p>
              <p className="text-[10px] text-slate-400">Secure Sync</p>
            </div>
            <div className="border-r border-slate-100 h-6 my-auto" />
            <div className="text-center">
              <p className="text-xs font-mono font-bold text-rose-500">Live PCM</p>
              <p className="text-[10px] text-slate-400">Speech Bridge</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentView("landing")}
              className="text-[11px] font-mono text-slate-400 hover:text-indigo-600 transition-all cursor-pointer inline-flex items-center gap-1"
            >
              ← Return to Landing Page & Philosophy
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans relative flex flex-col overflow-x-hidden selection:bg-indigo-600 selection:text-white">
      {/* Toast Notification HUD */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border-l-4 border-indigo-600 text-slate-800 py-3.5 px-6 rounded-xl shadow-lg border border-slate-200/50 flex items-center gap-3 transition-all duration-300 transform animate-bounce">
          <Sparkles className="text-indigo-600 w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Background Ambients */}
      <div className="absolute top-[-30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500 opacity-[0.03] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500 opacity-[0.02] blur-[130px] pointer-events-none" />

      {/* Hidden audio element for TTS playback */}
      <audio ref={audioPlayerRef} style={{ display: "none" }} />

      {/* API Configuration Warning Banner */}
      {user && !SYSTEM_ADMIN_EMAILS.includes(user.email?.toLowerCase() || "") && !userApiKey && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2.5 text-center text-xs flex items-center justify-center gap-2 relative z-50 shadow-sm animate-pulse-slow">
          <AlertTriangle className="w-4 h-4 text-white shrink-0" />
          <span>
            Logged in as <strong className="font-semibold">{user.email}</strong>. Press <strong>"Configure Key"</strong> to set your private Gemini API Key to run Planner integrations.
          </span>
          <button
            onClick={() => {
              setSettingsKeyInput(userApiKey);
              setShowSettingsModal(true);
            }}
            className="ml-3 bg-white text-amber-800 hover:bg-slate-50 border border-transparent font-bold px-3 py-1 rounded-lg text-[10px] transition-all cursor-pointer shadow-sm"
          >
            Configure Key
          </button>
        </div>
      )}

      {/* Main App Bar Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display tracking-tight text-slate-900 leading-none">Saarthi</h1>
                <span className="bg-indigo-50 text-indigo-600 text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold border border-indigo-100">Live Agent</span>
                <button
                  onClick={() => setCurrentView("landing")}
                  className="ml-2 text-[10px] font-mono uppercase px-2 py-0.5 text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-md transition-all cursor-pointer bg-white"
                >
                  Philosophy & Info
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase mt-0.5">Your Real-time Execution Partner</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Google Services Connection indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 font-mono">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold">Synced to Google Workspace</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              {user.photoURL ? (
                <img src={user.photoURL} alt="pfp" className="w-5 h-5 rounded-full" />
              ) : (
                <UserIcon className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-xs font-semibold text-slate-700 max-w-[100px] truncate">{user.displayName || user.email}</span>
            </div>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      {/* Main Single Screen Split Grid */}
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
        
        {/* LEFT COLUMN: Commitment planner and active cards (Grid bounds: 7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Section 1: Guide Me Planner Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-3 text-[10px] font-mono text-slate-300">v2.0 Active</div>
            <div>
              <h2 className="text-lg font-bold font-display text-slate-900 mb-1.5 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Commitment Decomposition Planner
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Enter any academic task, course assignment, project, or key milestone. Our planner will divide your task into manageable action blocks and schedule them before your target deadline.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <textarea
                  value={newCommitment}
                  onChange={(e) => setNewCommitment(e.target.value)}
                  placeholder="e.g., 'Draft 2500 word thesis abstract due Friday' or 'Prepare presentation slides for PM launch sync scheduled on Thursday noon'..."
                  className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-4 text-xs text-slate-800 placeholder-slate-400 outline-none resize-none min-h-[90px] transition-all"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 mb-1.5">Target Project Deadline</label>
                  <input
                    type="datetime-local"
                    value={customDeadline}
                    onChange={(e) => setCustomDeadline(e.target.value)}
                    className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg p-2 text-xs text-slate-800 outline-none"
                  />
                </div>
                <div className="flex justify-end items-end shrink-0">
                  <button
                    onClick={() => handleAddCommitment()}
                    disabled={isPlanning || !newCommitment.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 py-2.5 px-6 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-sm hover:shadow-indigo-100/50"
                  >
                    {isPlanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Decompose Task →
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Syllabus / screenshot Drag helper dropzone */}
              <div className="border border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/10 rounded-xl p-4 bg-slate-50/40 transition-all flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 rounded-lg">
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800">Visual Syllabus & Rubric Analyzer</h4>
                    <p className="text-[10px] text-slate-400">Upload a whiteboard snapshot, rubric photo or syllabus screenshot to pull tasks</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="file"
                    id="syllabus-file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSyllabusFileChange}
                  />
                  {analyzerPreview ? (
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <div className="flex items-center gap-2 justify-between">
                        <img src={analyzerPreview} alt="preview" className="w-8 h-8 rounded object-cover border border-slate-200" />
                        <button
                          onClick={() => {
                            setAnalyzerFile(null);
                            setAnalyzerPreview(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 text-[10px] underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1.5">
                        <button
                          onClick={handleOcrExtraction}
                          disabled={isOcrProcessing || isAnalyzing}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold py-1 px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          {isOcrProcessing ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Scanning...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              Extract Tasks (OCR)
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleAnalyzeSyllabus}
                          disabled={isAnalyzing || isOcrProcessing}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold py-1 px-2.5 rounded-lg transition-all cursor-pointer"
                        >
                          {isAnalyzing ? "Processing..." : "Simple Extract"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="syllabus-file"
                      className="bg-slate-100 hover:bg-slate-200 text-xs font-semibold py-1.5 px-4 rounded-lg transition-all cursor-pointer text-slate-700 text-center w-full sm:w-auto border border-slate-200"
                    >
                      Choose Image
                    </label>
                  )}
                </div>
              </div>

              {/* Example Prompts helper */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] font-mono text-slate-400">Quick templates:</span>
                <button
                  onClick={() => loadExampleCommitment("Physics Lab Assignment on thermal conductivity, due Friday. Need outline, formula spreadsheet, and 12-page write-up completed.")}
                  className="bg-slate-100 hover:bg-slate-200/85 text-slate-600 border border-slate-200/40 text-[10px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Physics Lab Report
                </button>
                <button
                  onClick={() => loadExampleCommitment("Refactor user database schema, setup firebase firestore indexing, and compile the local dev build on server by Thursday noon.")}
                  className="bg-slate-100 hover:bg-slate-200/85 text-slate-600 border border-slate-200/40 text-[10px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Tech Refactoring
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Active Commitments Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                Active Commitments ({tasks.length})
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                Real-time success state calculations live
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
              
              // Calculate average Completion Confidence across all active commitments
              const totalConfidence = scoredTasks.reduce((sum, t) => sum + t.analysis.completionConfidence, 0);
              const avgConfidence = totalActive > 0 ? Math.round(totalConfidence / totalActive) : 100;

              // Upcoming deadlines (chronological, excluding completed)
              const incompleteSorted = scoredTasks
                .filter(t => t.subtasks.some(s => !s.done))
                .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
              const nextDeadlines = incompleteSorted.slice(0, 2);

              // Overall Health State Rating
              let healthStatus = "Stable & Protected";
              let healthBadgeClass = "text-emerald-700 bg-emerald-50 border-emerald-100";
              let statusText = "Pacing indicators show clear safety margin before deadlines.";
              if (criticalCount > 0) {
                healthStatus = "Risk Drift Active";
                healthBadgeClass = "text-rose-750 bg-rose-50 border-rose-150 animate-pulse text-xs font-bold";
                statusText = `${criticalCount} commitment(s) at critical risk pace. Strategic intervention required.`;
              } else if (watchCount > 0) {
                healthStatus = "Increased Watch";
                healthBadgeClass = "text-amber-700 bg-amber-50 border-amber-100 text-xs font-bold";
                statusText = "Monitor buffer ratios or activate proactive preparation steps.";
              }

              return (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all hover:border-slate-350 animate-fade-up space-y-4">
                  {/* Glowing header badge */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-450 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-indigo-500" />
                      Execution Health Dashboard
                    </h4>
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg border ${healthBadgeClass}`}>
                      Workspace: {healthStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* KPI Item 1: Overall Workspace Completion Confidence */}
                    <div className="bg-white border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-sm col-span-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono tracking-wider uppercase text-slate-450 block font-bold">Workspace KPI</span>
                        <span className="text-sm font-bold text-slate-800 font-display block leading-none">Completion Confidence</span>
                        <span className="text-[10px] text-slate-400 font-mono block leading-tight mt-1">Average predictability forecast</span>
                      </div>
                      <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                        <svg className="w-14 h-14 transform -rotate-90">
                          <circle cx="28" cy="28" r="22" stroke="rgba(241, 245, 249, 1)" strokeWidth="4.5" fill="transparent" />
                          <circle cx="28" cy="28" r="22" stroke="#4f46e5" strokeWidth="4.5" fill="transparent"
                            strokeDasharray={2 * Math.PI * 22}
                            strokeDashoffset={2 * Math.PI * 22 * (1 - avgConfidence / 100)}
                            strokeLinecap="round" />
                        </svg>
                        <span className="absolute text-xs font-extrabold font-mono text-slate-800">{avgConfidence}%</span>
                      </div>
                    </div>

                    {/* KPI Item 2: Quick Metrics Counters */}
                    <div className="grid grid-cols-3 gap-2 col-span-2">
                      {/* Active Commitments */}
                      <div className="bg-white border border-slate-200/80 rounded-xl p-3 text-center flex flex-col justify-center items-center shadow-sm">
                        <span className="text-[9px] font-mono tracking-wider uppercase text-slate-400 font-bold block mb-1">Active</span>
                        <span className="text-xl font-mono font-black text-slate-800 leading-none">{totalActive}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Commitments</span>
                      </div>

                      {/* Critical Commitments */}
                      <div className={`border rounded-xl p-3 text-center flex flex-col justify-center items-center shadow-sm ${criticalCount > 0 ? "bg-rose-50/50 border-rose-150 text-rose-700 animate-pulse" : "bg-white border-slate-200/80 text-slate-800"}`}>
                        <span className="text-[9px] font-mono tracking-wider uppercase opacity-80 font-bold block mb-1">Critical</span>
                        <span className="text-xl font-mono font-black leading-none">{criticalCount}</span>
                        <span className="text-[8px] font-bold opacity-60 uppercase mt-1">Unsaved</span>
                      </div>

                      {/* Recovery Candidates */}
                      <div className={`border rounded-xl p-3 text-center flex flex-col justify-center items-center shadow-sm ${recoveryCount > 0 ? "bg-amber-50/50 border-amber-150 text-amber-700" : "bg-white border-slate-200/80 text-slate-800"}`}>
                        <span className="text-[9px] font-mono tracking-wider uppercase opacity-80 font-bold block mb-1">Recovery</span>
                        <span className="text-xl font-mono font-black leading-none">{recoveryCount}</span>
                        <span className="text-[8px] font-bold opacity-60 uppercase mt-1">Candidates</span>
                      </div>
                    </div>
                  </div>

                  {/* KPI Item 3: Upcoming deadlines sub-panel */}
                  {nextDeadlines.length > 0 && (
                    <div className="bg-white/80 border border-slate-200/80 p-3 rounded-xl shadow-sm text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Upcoming Deadlines & Targets</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {nextDeadlines.map(t => {
                          const hrs = getHoursRemaining(t.deadline);
                          const comp = t.subtasks.filter(s => s.done).length;
                          const tot = t.subtasks.length;
                          const progressPct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
                          const analysis = computeRiskScore(t);
                          return (
                            <div key={t.id} className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg flex items-center justify-between gap-3 text-[11px] leading-tight">
                              <div>
                                <span className="font-bold text-slate-800 block truncate max-w-[160px]">{t.title}</span>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{hrs.toFixed(1)}h left · {progressPct}% done</span>
                              </div>
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                                analysis.zone === "critical" ? "bg-rose-100 border-rose-200 text-rose-700" : "bg-indigo-50 border-indigo-150 text-indigo-700"
                              }`}>
                                Conf: {analysis.completionConfidence}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 font-mono text-center pt-1 border-t border-slate-150/40">
                    💡 {statusText} Target milestones require proactive calendar syncing to protect buffers.
                  </p>
                </div>
              );
            })()}

            {/* Smart Alerts & Urgent Execution Radar Banner */}
            {tasks.some(t => t.riskZone === "critical" || t.riskZone === "watch" || t.reminderContext) && (
              <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-2xl relative overflow-hidden space-y-3 shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100/30 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                    Urgent Execution Radar & Smart Alerts
                  </h4>
                  <span className="text-[9px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200/40 uppercase font-semibold">Action Required</span>
                </div>
                <div className="space-y-2">
                  {tasks
                    .filter(t => t.riskZone === "critical" || t.riskZone === "watch" || t.reminderContext)
                    .slice(0, 2)
                    .map(t => {
                       const hoursLeft = getHoursRemaining(t.deadline);
                       const isMeeting = t.title.toLowerCase().match(/meeting|prep|interview|session|skype|zoom|call|catchup|sync|talk/i);
                       return (
                         <div key={t.id} className="bg-white border border-amber-100/80 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-sm">
                           <div className="space-y-1 flex-1">
                             <div className="flex items-center gap-2">
                               <span className={`w-2 h-2 rounded-full ${t.riskZone === "critical" ? "bg-rose-500 animate-ping" : "bg-amber-500"}`} />
                               <span className="font-bold text-slate-800 text-xs truncate max-w-[200px]">{t.title}</span>
                               <span className="text-[10px] text-slate-400 font-mono">({hoursLeft.toFixed(1)}h left)</span>
                             </div>
                             {t.reminderContext ? (
                               <p className="text-[11px] text-slate-600" id={`radar-next-step-${t.id}`}>
                                 <span className="text-indigo-600 font-sans font-bold">Next Action: </span>
                                 "{t.reminderContext.nextLogicalStep}"
                               </p>
                             ) : (
                               <p className="text-[11px] text-slate-500">
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
                                 className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-semibold text-[10px] px-3 py-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer"
                                 id={`radar-btn-toggle-${t.id}`}
                               >
                                 {expandedReminderTaskId === t.id ? "Hide Guide" : "View Resources"}
                               </button>
                             ) : (
                               <button
                                 onClick={() => handleGetReminderContext(t)}
                                 disabled={generatingContextTaskId === t.id}
                                 className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                 id={`radar-btn-fetch-${t.id}`}
                               >
                                 {generatingContextTaskId === t.id ? (
                                   <>
                                     <RefreshCw className="w-3 h-3 animate-spin" />
                                     Compiling...
                                   </>
                                 ) : (
                                   <>
                                     <Sparkles className="w-3 h-3" />
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

            {tasks.length === 0 ? (
              <div className="bg-white/95 border border-indigo-100 rounded-2xl p-6 sm:p-8 shadow-sm text-slate-600 space-y-6 shrink-0 transition-all hover:shadow-indigo-50/50 hover:border-indigo-200">
                {/* Onboarding Header */}
                <div className="text-center space-y-1">
                  <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-full mb-1">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-black font-display text-slate-900 tracking-tight">Meet Saarthi: Your Smart Execution Partner</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Designed to eliminate anxiety and cognitive overload. Saarthi evaluates deadlines, reverse-engineers focus intervals, and blocks your procrastination.
                  </p>
                </div>

                {/* 15-second Judge Onboarding Pillars Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pillar 1 */}
                  <div className="bg-slate-50/70 border border-slate-200/50 p-4 rounded-xl space-y-1.5 relative overflow-hidden group hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Brain className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">1. Milestone Decomposition</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Syllabus snapshots, rubric photos or raw text get instantly reverse-engineered into high-impact tactical sprints before the deadline.
                    </p>
                  </div>

                  {/* Pillar 2 */}
                  <div className="bg-slate-50/70 border border-slate-200/50 p-4 rounded-xl space-y-1.5 relative overflow-hidden group hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">2. Completion Predictability</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Our determinism formulas track your <strong>Velocity</strong>, <strong>Calendar Pressure</strong>, and <strong>Complexity Weights</strong> to calculate success ratings.
                    </p>
                  </div>

                  {/* Pillar 3 */}
                  <div className="bg-slate-50/70 border border-slate-200/50 p-4 rounded-xl space-y-1.5 relative overflow-hidden group hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-605 rounded-lg group-hover:bg-indigo-605 group-hover:text-white transition-all">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">3. Google Calendar Locking</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Sync subtasks directly onto your calendar as locked execution blocks with duplicate safeguards and failure-resume sync tools.
                    </p>
                  </div>

                  {/* Pillar 4 */}
                  <div className="bg-slate-50/70 border border-slate-200/50 p-4 rounded-xl space-y-1.5 relative overflow-hidden group hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">4. Procrastination Defense</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Trigger interactive voice strategic advisory, copyable templates and live Google search grounded resources to get you through avoidant barriers.
                    </p>
                  </div>
                </div>

                {/* Call to action guide box */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs leading-relaxed">
                  <div className="flex items-center gap-2.5 text-slate-705">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
                    <span>
                      <strong className="font-semibold text-slate-800">Ready to test?</strong> Type an assignment or course milestone above, or launch a demo template:
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadExampleCommitment("Physics Lab Assignment on thermal conductivity, due Friday. Need outline, formula spreadsheet, and 12-page write-up completed.")}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm text-[11px] shrink-0"
                    >
                      🧪 Physics Demo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {tasks.map((task) => {
                  const rRemaining = getHoursRemaining(task.deadline);
                  const completedCount = task.subtasks.filter((s) => s.done).length;
                  const totalCount = task.subtasks.length;
                  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                  const isExpanded = expandedTaskId === task.id;

                  const analysis = computeRiskScore(task);
                  const actualProgressRatio = totalCount > 0 ? completedCount / totalCount : 0;
                  const now = Date.now();
                  const createdAtTime = task.createdAt ? new Date(task.createdAt).getTime() : now - 24 * 3600 * 1000;
                  const deadlineTime = new Date(task.deadline).getTime();
                  const totalDurationMs = Math.max(1000, deadlineTime - createdAtTime);
                  const timeElapsedMs = Math.max(0, now - createdAtTime);
                  const timelineProgressRatio = Math.min(1.0, timeElapsedMs / totalDurationMs);
                  const isAhead = actualProgressRatio >= timelineProgressRatio;

                  // Trend Indicator
                  let trendText = "Stalled";
                  let trendColorClass = "text-slate-500 bg-slate-50 border-slate-200/50";
                  if (pct === 100) {
                    trendText = "▲ Completed";
                    trendColorClass = "text-emerald-700 bg-emerald-50 border-emerald-150";
                  } else if (isAhead) {
                    trendText = "▲ Pacing Ahead";
                    trendColorClass = "text-emerald-650 bg-emerald-50 border-emerald-150";
                  } else {
                    trendText = "▼ Behind Pace";
                    trendColorClass = "text-rose-600 bg-rose-50 border-rose-150";
                  }

                  // Evaluate edge accent based on risk zone
                  let edgeAccent = "border-t-[4px] border-t-emerald-500";
                  if (analysis.zone === "critical") {
                    edgeAccent = "border-t-[4px] border-t-rose-500 animate-pulse";
                  } else if (analysis.zone === "watch") {
                    edgeAccent = "border-t-[4px] border-t-amber-500";
                  }

                  return (
                    <div
                      key={task.id}
                      className={`bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 shadow-sm hover:shadow transition-all relative overflow-hidden ${edgeAccent}`}
                    >
                      {/* Completion Confidence, Trend, and Risk Zone integration */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="space-y-1 flex-1">
                          <h4 className="text-base font-bold text-slate-900 tracking-tight leading-tight">{task.title}</h4>
                          <span className="text-xs text-slate-505 line-clamp-1 h-4">{task.description}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Due {new Date(task.deadline).toLocaleString()} · <Clock className="w-3 h-3 inline mb-0.5" /> {rRemaining.toFixed(1)}h remaining
                          </span>
                        </div>

                        {/* Completion Confidence Gauge & Badges */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className={`px-2.5 py-1.5 border rounded-xl text-center flex flex-col items-center justify-center min-w-[75px] font-mono shadow-sm ${
                            analysis.zone === "critical"
                              ? "bg-rose-50/75 border-rose-250 text-rose-750 font-extrabold"
                              : analysis.zone === "watch"
                              ? "bg-amber-50/75 border-amber-250 text-amber-700 font-bold"
                              : "bg-emerald-50/50 border-emerald-250 text-emerald-800 font-semibold"
                          }`}>
                            <span className="text-base sm:text-lg font-black">{analysis.completionConfidence}%</span>
                            <span className="text-[8px] font-bold tracking-wider uppercase mt-0.5">Confidence</span>
                          </div>
                          
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${trendColorClass}`}>
                              {trendText}
                            </span>
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full border ${
                              analysis.zone === "critical"
                                ? "bg-rose-100 border-rose-200 text-rose-700"
                                : analysis.zone === "watch"
                                ? "bg-amber-100 border-amber-200 text-amber-800"
                                : "bg-emerald-100 border-emerald-200 text-emerald-700"
                            }`}>
                              {analysis.zone}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Confidence Explanations diagnostics */}
                      <div className="mb-4 bg-slate-50/80 border border-slate-100/95 p-3 rounded-xl text-[11px] leading-relaxed shadow-sm">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1.5">
                          <Brain className="w-3.5 h-3.5 text-indigo-550" />
                          <span>Confidence Explanations</span>
                        </div>
                        <ul className="space-y-1 pl-1">
                          <li className="flex items-start gap-1.5 text-slate-600">
                            <span className="text-indigo-400 font-bold mt-0.5">•</span>
                            <span>{analysis.explanation.primaryReason}</span>
                          </li>
                          {analysis.explanation.secondaryReason && (
                            <li className="flex items-start gap-1.5 text-slate-650">
                              <span className="text-indigo-450 font-semibold mt-0.5">•</span>
                              <span>{analysis.explanation.secondaryReason}</span>
                            </li>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-150/40">
                            {actualProgressRatio < timelineProgressRatio && (
                              <span className="text-[9px] font-mono bg-rose-50/55 text-rose-600 px-2 py-0.5 rounded border border-rose-100">
                                Behind pacing target (-{Math.round((timelineProgressRatio - actualProgressRatio) * 100)}%)
                              </span>
                            )}
                            {task.complexity === "high" && (
                              <span className="text-[9px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200/50">
                                High complexity (requires buffer)
                              </span>
                            )}
                            {rRemaining < 18 && (
                              <span className="text-[9px] font-mono bg-rose-50/60 text-rose-605 px-2 py-0.5 rounded border border-rose-150 animate-pulse font-bold">
                                Limited remaining buffer
                              </span>
                            )}
                          </div>
                        </ul>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-[10px] text-slate-450 font-mono">
                          <span>Progress: {pct}%</span>
                          <span>{completedCount}/{totalCount} milestones done</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${
                            analysis.zone === "critical" ? "bg-rose-500" : analysis.zone === "watch" ? "bg-amber-500" : "bg-emerald-500"
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Task control tools actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                          >
                            {isExpanded ? "Close Milestones" : "Review Milestones"}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>

                          {task.reminderContext ? (
                            <button
                              onClick={() => setExpandedReminderTaskId(expandedReminderTaskId === task.id ? null : task.id)}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                              id={`card-btn-toggle-${task.id}`}
                            >
                              {expandedReminderTaskId === task.id ? "Hide Action Tips" : "Action Steps & Resources"}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedReminderTaskId === task.id ? "rotate-180" : ""}`} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleGetReminderContext(task)}
                              disabled={generatingContextTaskId === task.id}
                              className="text-xs font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              id={`card-btn-fetch-${task.id}`}
                            >
                              {generatingContextTaskId === task.id ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                                  Compiling Steps...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 text-indigo-600" />
                                  Build Action Steps
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayTTS(`Commitment brief: ${task.title}. Active progress is at ${pct}%. ${totalCount - completedCount} milestones remaining. Completion confidence is valued at ${analysis.completionConfidence}%`)}
                            className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            title="Play TTS Brief"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleSyncToGoogleCalendar(task)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1 ${task.googleCalendarSynced ? "text-emerald-600 bg-emerald-50 border border-emerald-100" : "text-slate-400 hover:bg-slate-50 border border-transparent hover:border-slate-200"}`}
                            title="Schedule Time blocks in Google Calendar"
                          >
                            <Calendar className="w-4 h-4" />
                            <span className="hidden sm:inline text-[10px] font-medium">{task.googleCalendarSynced ? "Scheduled" : "Sync G-Cal"}</span>
                          </button>

                          <button
                            onClick={() => handleSyncToGoogleTasks(task)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1 ${task.googleTasksSynced ? "text-emerald-600 bg-emerald-50 border border-emerald-100" : "text-slate-400 hover:bg-slate-50 border border-transparent hover:border-slate-200"}`}
                            title="Populate subtasks to Google Tasks"
                          >
                            <CheckSquare className="w-4 h-4" />
                            <span className="hidden sm:inline text-[10px] font-medium">{task.googleTasksSynced ? "Synced" : "Sync Tasks"}</span>
                          </button>

                          {analysis.zone !== "safe" && (
                            <button
                              onClick={() => handleGenerateRescuePlan(task)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-sans text-[10px] font-bold px-2 py-1 rounded border border-rose-200 shrink-0 cursor-pointer"
                              title="Generate dynamic recovery roadmap"
                            >
                              Rescue
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-xs text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                            title="Clear"
                          >
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Subtask List section */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-150 space-y-3 animate-fade-in text-sm">
                          <h5 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-400">Milestone Sequence</h5>
                          <div className="space-y-2">
                            {task.subtasks.map((sub) => (
                              <div
                                key={sub.id}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${sub.done ? "bg-emerald-50/40 border-emerald-100/40 text-emerald-800 line-through" : "bg-slate-50/60 border-slate-200 text-slate-700"}`}
                              >
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => handleToggleSubtask(task, sub.id)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${sub.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-indigo-500 bg-white"}`}
                                  >
                                    {sub.done && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                  </button>
                                  <span className="text-xs font-medium">{sub.title}</span>
                                </div>
                                <span className="text-[10px] text-slate-450 font-mono shrink-0">{sub.estimatedMinutes} mins</span>
                              </div>
                            ))}
                          </div>

                          {/* Risk mitigation factors block */}
                          <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/45 space-y-1.5 mt-2">
                            <h6 className="text-[10px] font-bold font-mono tracking-wider uppercase text-amber-800 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              Avoidance & Procrastination Shield Warning
                            </h6>
                            <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-655">
                              {task.riskFactors.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>

                          {/* Premium Visually Upgraded Recovery Plan with requested 5 sections */}
                          {task.recoveryPlan && (
                            <div className="mt-4 bg-slate-900 text-slate-100 rounded-2xl border border-rose-500/20 shadow-xl overflow-hidden animate-fade-in text-slate-300">
                              {/* Glowing Header */}
                              <div className="bg-gradient-to-r from-rose-950 to-slate-900 px-4 py-3 border-b border-rose-900/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                                  <span className="text-xs font-bold tracking-wider uppercase text-rose-300">Saarthi Critical Intervention Recovery Plan</span>
                                </div>
                                <span className="bg-rose-500/10 text-rose-400 text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-rose-500/25">Active Guard</span>
                              </div>

                              <div className="p-4 space-y-4 text-xs">
                                {/* 1. Situation Assessment */}
                                <div className="space-y-1">
                                  <div className="text-[10px] font-mono tracking-wider uppercase text-rose-400 font-bold">1. Situation Assessment</div>
                                  <p className="text-slate-300 leading-relaxed bg-rose-950/20 border border-rose-900/15 p-2.5 rounded-xl text-[11px]">
                                    {task.recoveryPlan.situationSummary}
                                  </p>
                                </div>

                                {/* 2. What To Prioritize */}
                                <div className="space-y-1">
                                  <div className="text-[10px] font-mono tracking-wider uppercase text-emerald-400 font-bold">2. What To Prioritize</div>
                                  <div className="flex items-start gap-2.5 bg-emerald-950/20 border border-emerald-900/15 p-2.5 rounded-xl text-slate-300 leading-relaxed">
                                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <div className="text-[11px]">{task.recoveryPlan.messageToUser}</div>
                                  </div>
                                </div>

                                {/* 3. What To Delay (Operational descaling compromise) */}
                                <div className="space-y-1">
                                  <div className="text-[10px] font-mono tracking-wider uppercase text-amber-400 font-bold">3. What To Delay (De-Scope Compromise)</div>
                                  <div className="bg-amber-950/20 border border-amber-900/15 p-3 rounded-xl space-y-1.5 text-slate-300">
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      <span>Postpone optional stylistic refactoring and non-critical beautification.</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      <span>Defer secondary review pipelines or peer audits until draft is compiled.</span>
                                    </div>
                                    <div className="inline-block mt-1 text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-mono">
                                      De-risk standard pacing buffer to protect core commitments
                                    </div>
                                  </div>
                                </div>

                                {/* 4. New Execution Plan */}
                                <div className="space-y-1">
                                  <div className="text-[10px] font-mono tracking-wider uppercase text-sky-400 font-bold">4. New Execution Plan</div>
                                  <p className="text-slate-300 leading-relaxed bg-sky-950/20 border border-sky-900/15 p-2.5 rounded-xl font-mono text-[11px]">
                                    {task.recoveryPlan.advice}
                                  </p>
                                </div>

                                {/* 5. Expected Improvement */}
                                <div className="bg-gradient-to-r from-indigo-950 to-slate-900 border border-indigo-500/20 p-3 rounded-xl flex items-center justify-between gap-3 shadow-md">
                                  <div>
                                    <div className="text-[10px] font-mono tracking-wider uppercase text-indigo-400 font-bold font-semibold">5. Expected Improvement</div>
                                    <p className="text-[11px] text-slate-400">Pace safety buffers restabilized by emergency descaling.</p>
                                  </div>
                                  <div className="text-right shrink-0 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
                                    <span className="text-[10px] font-mono text-indigo-350 block uppercase font-bold leading-none mb-0.5 font-semibold">Workspace</span>
                                    <span className="text-xs font-black text-emerald-400 font-mono tracking-tight">+20% Confidence</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded Reminder Context Panel */}
                      {expandedReminderTaskId === task.id && task.reminderContext && (
                        <div className="mt-4 pt-4 border-t border-slate-150 space-y-4 animate-fade-in text-sm" id={`reminder-panel-${task.id}`}>
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold font-mono tracking-wider uppercase text-emerald-600 flex items-center gap-1.5">
                              <Brain className="w-3.5 h-3.5" />
                              Active Execution Guidance
                            </h5>
                            <span className="text-[9px] font-mono text-slate-400">
                              Generated via Gemini · {new Date(task.reminderContext.createdAt).toLocaleTimeString()}
                            </span>
                          </div>

                          {/* Immediate next logical step */}
                          <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100">
                            <span className="text-[9px] font-mono text-emerald-800 uppercase tracking-wider block mb-1 font-bold">Immediate Next Step</span>
                            <p className="text-xs font-bold text-slate-800 leading-relaxed">
                              "{task.reminderContext.nextLogicalStep}"
                            </p>
                          </div>

                          {/* Contextual Wisdom */}
                          <div className="space-y-1">
                            <span className="text-[9px] font-mono text-amber-800 uppercase tracking-wider block font-bold">Strategic Procrastination Guard</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {task.reminderContext.contextualAdvice}
                            </p>
                          </div>

                          {/* Starter Template Outline */}
                          {task.reminderContext.draftTemplate && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Starter Document / Agenda Draft</span>
                                <button
                                  onClick={() => handleCopyText(task.reminderContext!.draftTemplate)}
                                  className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                                >
                                  Copy Template
                                </button>
                              </div>
                              <textarea
                                readOnly
                                value={task.reminderContext.draftTemplate}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 font-mono h-[140px] resize-none outline-none focus:ring-0"
                              />
                            </div>
                          )}

                          {/* Grounded Web Resource query search redirects */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Recommended Web Resource Guidelines</span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {task.reminderContext.resourceSearchQueries.map((q, i) => (
                                <a
                                  key={i}
                                  href={`https://www.google.com/search?q=${encodeURIComponent(q)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 bg-slate-50 hover:bg-indigo-50/30 border border-slate-250 hover:border-indigo-300 rounded-xl transition-all flex items-center justify-between text-xs group"
                                >
                                  <span className="text-slate-700 group-hover:text-indigo-600 truncate pr-1 text-[11px] font-medium">{q}</span>
                                  <Search className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>

                          {/* Vocal coach Playbook */}
                          <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Volume2 className="w-4 h-4 text-indigo-600" />
                              <div>
                                <span className="text-[9px] font-mono text-indigo-800 uppercase block leading-none font-bold">Audio Briefing Playbook</span>
                                <p className="text-[11px] text-slate-500 mt-1">Listen to Saarthi vocalize these action files</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePlayTTS(`Attention. Review your next step: ${task.reminderContext!.nextLogicalStep}. Saarthi advises you to: ${task.reminderContext!.contextualAdvice}`)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-sm shadow-indigo-100"
                            >
                              <Play className="w-3 h-3" />
                              Play Vocal Brief
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Tabbed Active Assistant Workspace (Grid bounds: 5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm min-h-[550px]">
          
          {/* Workspace Tabs Header bar */}
          <div className="flex border-b border-slate-200 bg-slate-50 p-1 shrink-0">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2.5 px-2 text-xs font-bold text-center m-0.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === "chat" ? "bg-white text-slate-800 shadow-sm border border-slate-200/40" : "text-slate-500 hover:text-slate-800 hover:bg-white/45"}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Chat Support
            </button>
            <button
              onClick={() => setActiveTab("voice")}
              className={`flex-1 py-2.5 px-2 text-xs font-bold text-center m-0.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === "voice" ? "bg-white text-slate-800 shadow-sm border border-slate-200/40" : "text-slate-500 hover:text-slate-800 hover:bg-white/45"}`}
            >
              <Mic className="w-3.5 h-3.5 text-rose-500" />
              Live Speech
            </button>
            <button
              onClick={() => setActiveTab("poster")}
              className={`flex-1 py-2.5 px-2 text-xs font-bold text-center m-0.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === "poster" ? "bg-white text-slate-800 shadow-sm border border-slate-200/40" : "text-slate-500 hover:text-slate-800 hover:bg-white/45"}`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
              Visual Poster
            </button>
            <button
               onClick={() => setActiveTab("help")}
               className={`py-2.5 px-4 text-xs font-bold text-center m-0.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === "help" ? "bg-white text-slate-800 shadow-sm border border-slate-200/40" : "text-slate-500 hover:text-slate-800 hover:bg-white/45"}`}
               title="Help information"
            >
               <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Area 1: Multi-turn Chat Assistant Workspace */}
          {activeTab === "chat" && (
            <div className="flex flex-col flex-grow overflow-hidden">
              {/* Controls bar */}
              <div className="bg-slate-50 border-b border-slate-200 p-3 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Persona:</span>
                  <select
                    value={chatPersona}
                    onChange={(e) => setChatPersona(e.target.value as any)}
                    className="bg-white border border-slate-200 text-slate-700 rounded px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="navigator">Calm Strategic Navigator</option>
                    <option value="shield">Procrastination Shield</option>
                    <option value="coach">Tough Love Taskmaker</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-850 transition-colors">
                    <input
                      type="checkbox"
                      checked={enableGrounding}
                      onChange={(e) => setEnableGrounding(e.target.checked)}
                      className="rounded border-slate-200 text-indigo-600 accent-indigo-600"
                    />
                    <span>Web Search</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-850 transition-colors" title="Deep high thinking reasoning mode with gemini-3.1-pro-preview">
                    <input
                      type="checkbox"
                      checked={enableThinking}
                      onChange={(e) => setEnableThinking(e.target.checked)}
                      className="rounded border-slate-200 text-indigo-600 accent-indigo-600"
                    />
                    <span>High Thinking</span>
                  </label>
                </div>
              </div>

              {/* Chat list history */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[460px]">
                {chats.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 my-10">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shadow-indigo-100">
                      <Sparkles className="w-5 h-5 animate-spin" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">Ask your Coach or Planner anything</p>
                    <p className="text-[11px] text-slate-400 max-w-[280px]">
                      "How do I structure my lab abstract writeup?" or "Give me structured tips to stop dreading this assignment."
                    </p>
                  </div>
                ) : (
                  chats.map((c, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${c.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mb-1 font-mono uppercase font-bold">
                        {c.role === "user" ? "You" : `Coach (${chatPersona})`}
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${c.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-100 border border-slate-200/50 text-slate-850 rounded-tl-none"}`}
                      >
                        {c.text}
                      </div>
                    </div>
                  ))
                )}

                {/* Grounding sources citation block */}
                {chatSources.length > 0 && (
                  <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-1">
                    <span className="text-[9px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">Google Search Citation links</span>
                    <div className="flex flex-col gap-1 text-[10px]">
                      {chatSources.map((link, idx) => {
                        const url = link.web?.uri || "#";
                        const title = link.web?.title || url;
                        return (
                          <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline hover:text-indigo-700 font-medium truncate">
                            {idx + 1}. {title}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isChatSending && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Saarthi is thinking...</span>
                  </div>
                )}
              </div>

              {/* Chat Input message block */}
              <div className="border-t border-slate-200 p-3 flex gap-2 bg-slate-50/50 shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                  placeholder="Type a message or ask your coach..."
                  className="flex-grow bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSendChatMessage}
                  disabled={isChatSending || !chatInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer text-white shadow-sm"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Area 2: Live Conversation PCM Voice Stream Workspace */}
          {activeTab === "voice" && (
            <div className={`flex-1 flex flex-col p-6 items-center justify-center text-center space-y-6 transition-all duration-300 ${isLiveActive ? "bg-slate-950 text-white border border-slate-800 rounded-3xl shadow-inner shadow-slate-900/50" : "bg-white/50 border border-slate-200/60 rounded-3xl"}`}>
              <div className="relative flex items-center justify-center">
                {/* Glowing ring effects that scale up with speak */}
                <div className={`absolute w-32 h-32 rounded-full blur-md transition-all duration-500 scale-110 ${isLiveActive ? "bg-rose-500/20 pulse-circle" : "bg-indigo-100/50"}`} />
                <div className={`absolute w-24 h-24 rounded-full blur-sm transition-all duration-500 ${isLiveActive ? "bg-violet-500/25 pulse-circle" : "bg-slate-100"}`} />

                <button
                  onClick={handleStartLiveCall}
                  className={`w-16 h-16 rounded-full flex items-center justify-center z-10 transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer ${isLiveActive ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20" : "bg-slate-100 hover:bg-slate-200 text-indigo-600 border border-slate-200"}`}
                >
                  {isLiveActive ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5 text-rose-500" />}
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-400">Gemini Live Audio Bridge</h3>
                <p className={`text-xs max-w-[300px] leading-relaxed transition-colors ${isLiveActive ? "text-slate-300" : "text-slate-500"}`}>
                  {isLiveActive ? "Duplex voice session connected. Start speaking to your Coach now!" : "Launch the hardware gate connection to engage hands-free execution advice."}
                </p>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-mono transition-all ${isLiveActive ? "bg-slate-900/80 border-slate-800 text-emerald-400" : "bg-slate-50 border-slate-250/50 text-slate-500"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? "bg-emerald-400 animate-ping" : "bg-rose-400"}`} />
                  <span>{liveLog}</span>
                </div>
              </div>

              {/* Voice waveforms drawing canvas simulation */}
              {isLiveActive && (
                <div className="w-full flex items-center justify-center gap-1.5 h-10 px-6">
                  {[...Array(16)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-indigo-500 to-rose-400 rounded-full transition-all duration-150 animate-pulse"
                      style={{
                        height: `${Math.floor(Math.random() * 32) + 6}px`,
                        animationDelay: `${i * 90}ms`
                      }}
                    />
                  ))}
                </div>
              )}

              <div className={`text-[10px] max-w-[320px] leading-relaxed transition-colors ${isLiveActive ? "text-slate-450" : "text-slate-400"}`}>
                Employs 16-bit PCM codec audio duplexed via secure WebSockets with model <strong>gemini-3.1-flash-live-preview</strong> for low-latency feedback circles. Live feedback executes natively.
              </div>
            </div>
          )}

          {/* Area 3: Visual Poster wallpaper generator with gemini-3-pro-image-preview */}
          {activeTab === "poster" && (
            <div className="flex flex-col flex-grow p-4 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  Custom Motivation Wallpaper Compiler
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Generate a custom poster, study wallpaper, or visual dashboard background matched with your style.
                </p>
              </div>

              <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <div>
                  <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 mb-1.5">Design Prompt</label>
                  <input
                    type="text"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="e.g., 'Minimalist cozy wooden workspace under starry sky, high contrast typography...'"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 mb-1">Image Size Resolution</label>
                    <div className="flex gap-2">
                      {(["1K", "2K", "4K"] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => setImageSize(size)}
                          className={`px-3 py-1 text-xs font-mono rounded border transition-all cursor-pointer ${imageSize === size ? "bg-indigo-600 text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleGeneratePoster}
                    disabled={isGeneratingImg || !imagePrompt.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 text-xs font-semibold py-2.5 px-4 rounded-xl mt-4 self-end cursor-pointer shadow-sm shadow-indigo-100"
                  >
                    {isGeneratingImg ? "Generating..." : "Compile Image"}
                  </button>
                </div>
              </div>

              {generatedImg && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  <span className="text-[10px] font-mono text-emerald-800 font-bold tracking-wider block">Compiled Poster Output:</span>
                  <img src={generatedImg} alt="wallpaper generation output" className="w-full object-cover rounded-lg border border-slate-200" referrerPolicy="no-referrer" />
                  <a
                    href={generatedImg}
                    download="saarthi_motivation_wallpaper.png"
                    className="text-xs text-indigo-600 hover:underline block text-center font-bold"
                  >
                    Download Poster Image File
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Area 4: Help instructions workspace */}
          {activeTab === "help" && (
            <div className="flex-grow p-6 space-y-4 overflow-y-auto leading-relaxed text-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase font-display tracking-wide">About Saarthi AI Guide</h3>
              <p className="text-slate-500">
                Saarthi was developed to address critical deadline management failures. Instead of traditional reminder tools that produce notification fatigue, Saarthi acts as a strategic execution guide.
              </p>
              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 border border-slate-200/80">
                  <h4 className="font-semibold text-slate-800">How Success Probability Works:</h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Continuous calculations monitor remaining hours, total effort requested, subtasks checked completed, and known risk penalties. This calculates a dynamic risk index out of 100 on live records. Go Watch out or activate 'Rescue' if score stays Critical.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 border border-slate-200/80">
                  <h4 className="font-semibold text-slate-800">Authentication & Workspace integrations</h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Firebase Auth secures data persistence across client nodes. Deeply sync tasks to your private Google Calendar and Tasks lists securely, directly inside browser using credential access tokens.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* Settings Modal Component Overlay */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-display text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600 animate-spin-slow" />
                Saarthi API Settings
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                To run custom task generation, smart plan analysis, real-time voice, and chat features, supply your personal Google Gemini API key here.
              </p>
              <div className="p-3 bg-indigo-50 border border-indigo-100/50 rounded-xl space-y-1">
                <h4 className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">Privacy & Durability</h4>
                <p className="text-[10px] text-indigo-700 leading-relaxed">
                  Every time you sign in on any device, the same key is restored instantly. Your credentials are securely persisted in your individual Firestore record and never exposed publicly.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400">Gemini API Key</label>
                <input
                  type="password"
                  value={settingsKeyInput}
                  onChange={(e) => setSettingsKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all font-mono"
                />
              </div>

              <div className="text-[10px] text-slate-400">
                Don't have a key? Get one for free at{" "}
                <a
                  href="https://ai.google.dev/gemini-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Google AI Studio
                </a>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 transition-colors cursor-pointer font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs transition-colors cursor-pointer font-bold shadow-sm shadow-indigo-100"
              >
                Save key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Commitment Review Queue Modal */}
      {isOcrReviewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-4xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col animate-fade-in animate-duration-150">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-display text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                  Saarthi OCR Commitment Import Planner
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Review, edit, and schedule extracted commitments before importing them into Saarthi.
                </p>
              </div>
              <button
                onClick={() => {
                  setExtractedCommitments([]);
                  setIsOcrReviewOpen(false);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Overall Confidence Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50 rounded-2xl p-4 gap-4 border border-slate-200/60">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Visual Legibility Scan Result</h4>
                <p className="text-[10px] text-slate-400">Our Gemini Vision scan verified details across multiple sections of your document</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">System Accuracy Confidence</span>
                  <div className="text-lg font-black font-mono text-indigo-600">{ocrOverallConfidence}%</div>
                </div>
                <div className="w-16 bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      ocrOverallConfidence >= 85 ? "bg-indigo-600" : ocrOverallConfidence >= 60 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${ocrOverallConfidence}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Scrollable Queue Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {extractedCommitments.map((item, idx) => (
                <div key={item.id} className="border border-slate-200/80 rounded-2xl p-5 bg-white shadow-xs hover:shadow-sm transition-all space-y-4 relative group">
                  {/* Commitment Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-mono py-0.5 px-2 rounded-md font-bold">COMMITMENT #{idx + 1}</span>
                      <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold py-0.5 px-2 rounded-md">
                        <span>Scan Match:</span>
                        <span className="font-bold">{item.confidence}%</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteExtractedCommitment(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                      title="Discard this commitment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Fields Grid 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Title */}
                    <div className="md:col-span-8 space-y-1">
                      <label className="block text-[10px] font-mono uppercase text-slate-400">Commitment Title</label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateExtractedCommitment(item.id, "title", e.target.value)}
                        className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg p-2.5 text-xs text-slate-800 outline-none"
                        placeholder="e.g. Physics Midterm Exam"
                      />
                    </div>

                    {/* Deadline */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="block text-[10px] font-mono uppercase text-slate-400">Extracted Deadline</label>
                      <input
                        type="datetime-local"
                        value={item.deadline}
                        onChange={(e) => handleUpdateExtractedCommitment(item.id, "deadline", e.target.value)}
                        className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg p-2.5 text-xs text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  {/* Fields Grid 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Description */}
                    <div className="md:col-span-8 space-y-1">
                      <label className="block text-[10px] font-mono uppercase text-slate-400">Extracted Requirements & Syllabus Notes</label>
                      <textarea
                        value={item.description}
                        onChange={(e) => handleUpdateExtractedCommitment(item.id, "description", e.target.value)}
                        rows={2}
                        className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg p-2.5 text-xs text-slate-800 outline-none resize-none"
                        placeholder="Extracted details, requirements..."
                      />
                    </div>

                    {/* Estimated effort */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="block text-[10px] font-mono uppercase text-slate-400">Estimated Effort (Minutes)</label>
                      <input
                        type="number"
                        value={item.estimatedMinutes}
                        onChange={(e) => handleUpdateExtractedCommitment(item.id, "estimatedMinutes", parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg p-2.5 text-xs text-slate-800 outline-none"
                        min="10"
                        max="1440"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {extractedCommitments.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="text-slate-400 font-bold">No commitments in queue</div>
                  <p className="text-[11px] text-slate-400">Click Cancel or upload another photo to start extraction.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setExtractedCommitments([]);
                  setIsOcrReviewOpen(false);
                }}
                className="px-4 py-2 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-bold transition-colors cursor-pointer"
              >
                Discard All
              </button>
              <button
                onClick={handleImportExtractedCommitments}
                disabled={isAnalyzing || extractedCommitments.length === 0}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-100 flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing Decomposition...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm and Import {extractedCommitments.length} Tasks →
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
