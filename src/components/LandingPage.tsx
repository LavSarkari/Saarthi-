import React, { useState, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "motion/react";
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Mic,
  Camera,
  CheckCircle2,
  X,
  Play,
  ArrowRightLeft,
  ChevronRight,
  Upload,
  Layers,
  Clock,
  ShieldCheck,
  Eye,
  Settings,
  Flame,
  Zap,
  RotateCcw,
  MessageCircle,
  LayoutDashboard,
  ArrowDown,
  GitBranch,
  CreditCard,
  Bot,
  FileText,
  Check,
  Activity,
  RefreshCw,
  Lock,
  Unlock,
} from "lucide-react";

interface LandingPageProps {
  onLaunch: () => void;
  isLoggedIn: boolean;
}

export default function LandingPage({
  onLaunch,
  isLoggedIn,
}: LandingPageProps) {
  // Centerpiece step control
  const [activeCenterpieceStep, setActiveCenterpieceStep] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  const centerpieceSteps = [
    {
      label: "1. Capture & Vision OCR",
      title: "Deconstruct the Overwhelming",
      desc: "Upload a syllabus screenshot, bill document, or dictate 'I have a computer networks final next Friday'. Gemini Vision extracts structured commitments instantly.",
      color: "from-blue-500 to-indigo-500",
      icon: Camera,
      status: "Parsing raw commitment...",
      confidence: "Vision OCR Verified",
    },
    {
      label: "2. Prerequisite DAG Engine",
      title: "Dependency-Aware Task Mapping",
      desc: "Saarthi constructs a Directed Acyclic Graph (DAG). Kahn's topological sort orders tasks so prerequisites (Task A → Task B) execute in strict sequence.",
      color: "from-indigo-500 to-purple-500",
      icon: GitBranch,
      status: "Kahn's Sort: 0 Cycles Detected",
      confidence: "DAG Validated",
    },
    {
      label: "3. Deterministic Scheduling",
      title: "Non-Overlapping Time-Boxing",
      desc: "Subtasks are time-boxed into working hours (09:00–22:00) without AI heuristics. HARD commitments protect non-negotiable slots, while FLEXIBLE work adapts.",
      color: "from-purple-500 to-pink-500",
      icon: Calendar,
      status: "Slots Allocated (09:00–22:00)",
      confidence: "Time-Box Secured",
    },
    {
      label: "4. Multi-Factor Risk Scoring",
      title: "Real-Time Risk Intelligence",
      desc: "Continuously computes Risk Scores (0–100) and zones (SAFE, WATCH, CRITICAL) using velocity, buffer ratios, task complexity, and commitment semantics.",
      color: "from-pink-500 to-rose-500",
      icon: AlertTriangle,
      status: "Zone: WATCH (Score: 54)",
      confidence: "Live Risk Evaluated",
    },
    {
      label: "5. Autonomous Rescheduling & Recovery",
      title: "Instant Event-Driven Repair",
      desc: "When delays occur, Saarthi recalculates affected dependency chains, generates Recovery OS compromise plans, updates Google Calendar, and alerts via Telegram.",
      color: "from-emerald-400 to-teal-500",
      icon: RefreshCw,
      status: "Google Calendar & Telegram Synced",
      confidence: "100% Execution Secured",
    },
  ];

  // Auto-play centerpiece steps
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCenterpieceStep((prev) => (prev + 1) % centerpieceSteps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Signature Innovation: Multi-Factor Risk Score Simulator
  const [simProgressRatio, setSimProgressRatio] = useState(0.25); // 0 to 1.0
  const [simHoursLeft, setSimHoursLeft] = useState(18); // 1 to 120
  const [simIsHard, setSimIsHard] = useState(true);
  const [simComplexity, setSimComplexity] = useState("high"); // low, medium, high
  const [simIsOverdueBill, setSimIsOverdueBill] = useState(false);
  const [simRecoveryActive, setSimRecoveryActive] = useState(false);

  // Compute exact simulated risk score matching src/lib/riskEngine.ts formula
  const calculateSimulatedRisk = () => {
    const totalEffortHours = 8;
    const effortRemaining = totalEffortHours * (1.0 - simProgressRatio);
    const bufferRatio = effortRemaining > 0 ? simHoursLeft / effortRemaining : 10;

    // 1. Velocity penalty
    const timelineRatio = Math.min(1.0, (60 - simHoursLeft) / 60);
    const velocityDiff = Math.max(0, timelineRatio - simProgressRatio);
    const complexityWeight = simComplexity === "high" ? 1.35 : simComplexity === "medium" ? 1.0 : 0.7;
    const velocityPenalty = velocityDiff * 35 * complexityWeight;

    // 2. Schedule pressure penalty
    let pressurePenalty = 0;
    if (simHoursLeft <= 0) pressurePenalty = 40;
    else if (bufferRatio < 1.0) pressurePenalty = 35;
    else if (bufferRatio < 2.0) pressurePenalty = (2.0 - bufferRatio) * 30;
    pressurePenalty *= complexityWeight;

    if (simHoursLeft < 12 && simProgressRatio < 1.0) {
      pressurePenalty += Math.min(20, (12 - simHoursLeft) * 1.5);
    }

    // 3. Complexity penalty
    const complexityPenalty = simComplexity === "high" ? 15 : simComplexity === "medium" ? 7 : 0;

    // 4. Commitment penalties
    let commitmentPenalty = 0;
    if (simIsHard && simHoursLeft < 24 && simProgressRatio < 1.0) commitmentPenalty += 15;
    if (simIsOverdueBill) commitmentPenalty += 35;

    // 5. Recovery mitigation
    const recoveryMitigation = simRecoveryActive ? 25 : 0;

    // Base risk
    const baseRisk = (1.0 - simProgressRatio) * 35;

    let score = baseRisk + velocityPenalty + pressurePenalty + complexityPenalty + commitmentPenalty - recoveryMitigation;
    score = Math.max(0, Math.min(100, Math.round(score)));

    if (simProgressRatio >= 1.0) score = 0;

    let zone: "safe" | "watch" | "critical" = "safe";
    if (score >= 70 || (simHoursLeft < 3 && simProgressRatio < 1.0) || simIsOverdueBill) {
      zone = "critical";
    } else if (score >= 40) {
      zone = "watch";
    }

    return { score, zone, bufferRatio: bufferRatio.toFixed(1) };
  };

  const simResult = calculateSimulatedRisk();

  // OCR Showcase interactive sample selection
  const [ocrSampleIndex, setOcrSampleIndex] = useState(0);
  const ocrSamples = [
    {
      title: "CS 311 Syllabus.png",
      date: "Aug 14, 2026",
      extracted: [
        {
          title: "Database Architecture Midterm",
          deadline: "2026-08-20T10:00",
          type: "HARD",
          d: "Chapters 1-6 relational algebra and indexing.",
          min: 180,
          conf: 98,
        },
        {
          title: "Relational Algebra Problem Set",
          deadline: "2026-08-25T23:59",
          type: "FLEXIBLE",
          d: "SQL query optimization questions.",
          min: 120,
          conf: 95,
        },
      ],
    },
    {
      title: "Quarterly_Host_Invoice.pdf",
      date: "Aug 12, 2026",
      extracted: [
        {
          title: "Cloud Infrastructure Server Bill",
          deadline: "2026-08-18T17:00",
          type: "HARD",
          d: "Production hosting invoice ($142.50).",
          min: 15,
          conf: 99,
        },
        {
          title: "Domain Subscription Renewal",
          deadline: "2026-08-30T00:00",
          type: "FLEXIBLE",
          d: "Auto-renewal check & verification.",
          min: 30,
          conf: 92,
        },
      ],
    },
  ];

  // Demo Video/Walkthrough Modal State
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <main className="min-h-screen bg-black text-slate-100 font-sans selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      {/* Dynamic Backgrounds */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[500px] rounded-full bg-gradient-to-tr from-indigo-600/10 to-transparent blur-[160px] pointer-events-none" />
      <div className="absolute top-[20%] right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-purple-600/5 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-10 w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-pink-600/5 to-transparent blur-[180px] pointer-events-none" />

      {/* Grid Mesh */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Floating Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? "pt-4 px-4" : ""}`}
      >
        <header
          className={`mx-auto backdrop-blur-md transition-all duration-500 overflow-hidden flex items-center justify-between ${
            isScrolled
              ? "max-w-5xl rounded-full border border-white/10 bg-black/80 shadow-2xl shadow-indigo-500/10 h-16 px-6"
              : "w-full border-b border-white/[0.06] bg-black/70 h-18 px-6 max-w-7xl"
          }`}
        >
          <div
            className="flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div
              className={`rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/10 flex items-center justify-center transition-all ${isScrolled ? "h-8 w-8" : "h-9 w-9"}`}
            >
              <div className="h-full w-full bg-black rounded-[10px] flex items-center justify-center">
                <Sparkles
                  className={`${isScrolled ? "w-4 h-4" : "w-4.5 h-4.5"} text-indigo-400 animate-pulse`}
                />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span
                  className={`font-display font-bold tracking-tight text-white leading-none ${isScrolled ? "text-sm" : "text-base"}`}
                >
                  Saarthi
                </span>
                <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-semibold">
                  EXECUTION OS
                </span>
              </div>
              {!isScrolled && (
                <span className="text-[9px] text-slate-400 font-medium tracking-tight mt-0.5">
                  AI-Powered Behavioral Execution Engine
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-[11px] font-mono tracking-widest uppercase text-slate-400">
              <a
                href="#architecture"
                className="hover:text-white transition-colors relative group py-2"
              >
                Engine Architecture
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="#features"
                className="hover:text-white transition-colors relative group py-2"
              >
                Features
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="#risk-simulator"
                className="hover:text-white transition-colors relative group py-2"
              >
                Risk Engine
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="#ocr"
                className="hover:text-white transition-colors relative group py-2"
              >
                Vision OCR
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
            </nav>

            <button
              onClick={onLaunch}
              className={`flex items-center justify-center gap-1.5 rounded-full transition-all duration-300 cursor-pointer font-bold ${
                isScrolled
                  ? "bg-white text-black px-4 py-2 text-[11px] hover:scale-105 hover:shadow-lg hover:shadow-white/20"
                  : "bg-white/10 text-white border border-white/20 px-4 py-2 text-[11px] hover:bg-white/20"
              }`}
            >
              Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      </div>

      {/* 1. HERO SECTION */}
      <section className="relative pt-32 pb-24 px-6 max-w-7xl mx-auto text-center space-y-8 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-indigo-400 tracking-wider uppercase">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
          </span>
          Deterministic Execution Engine + Gemini AI Interface
        </div>

        <h1 className="text-4xl md:text-7xl font-bold font-display tracking-tight text-white max-w-5xl mx-auto leading-[1.1]">
          Don't Just Track Tasks.<br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
            Actively Govern Execution.
          </span>
        </h1>

        <p className="text-slate-300 text-sm md:text-lg max-w-3xl mx-auto leading-relaxed">
          Saarthi does not merely remind you what to do. It actively determines what should happen next, when it should happen, what gets moved when life interrupts, and how hard deadlines are protected.
        </p>

        {/* Technical Distinction Banner */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 text-left pt-2">
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 space-y-1">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold font-mono">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Gemini AI Interface Layer
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Decomposes raw goals, parses syllabus images via Vision OCR, handles live PCM voice consultations, and powers Telegram companion chat.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-1">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold font-mono">
              <Zap className="w-4 h-4 text-emerald-400" />
              Deterministic Rules Engine
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Kahn's DAG dependency sorting, 09:00–22:00 subtask time-boxing, automatic rescheduling, multi-factor risk scoring, and atomic disk persistence.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onLaunch}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-sm font-bold text-white rounded-full transition-all duration-300 shadow-xl shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2 group"
          >
            Launch Workspace
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => setShowDemoModal(true)}
            className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-white rounded-full transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-3.5 h-3.5 text-indigo-400" />
            Watch Execution Flow
          </button>
        </div>

        {/* HERO VISUAL: Step Pipeline */}
        <div className="pt-8 max-w-4xl mx-auto">
          <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl relative shadow-2xl">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-white/10 pb-6">
              {centerpieceSteps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = activeCenterpieceStep === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveCenterpieceStep(idx)}
                    className={`flex flex-col items-center p-3 rounded-2xl transition-colors duration-200 cursor-pointer text-center space-y-1.5 border ${
                      isActive
                        ? "bg-white/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10"
                        : "border-transparent hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg ${isActive ? "bg-indigo-500/20 text-indigo-400" : "text-slate-500"}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[9px] font-mono tracking-tight font-semibold ${isActive ? "text-white" : "text-slate-500"}`}
                    >
                      {step.label.split(". ")[1]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="py-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center text-left min-h-[260px]">
              <div className="md:col-span-7 relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCenterpieceStep}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-mono font-semibold">
                      <span>Pipeline Engine State:</span>
                      <span className="uppercase text-white animate-pulse">
                        {centerpieceSteps[activeCenterpieceStep].status}
                      </span>
                    </div>
                    <h3 className="text-xl md:text-3xl font-bold tracking-tight text-white font-display">
                      {centerpieceSteps[activeCenterpieceStep].title}
                    </h3>
                    <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                      {centerpieceSteps[activeCenterpieceStep].desc}
                    </p>

                    <div className="pt-2 flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-400">
                        Execution Status:
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {centerpieceSteps[activeCenterpieceStep].confidence}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="md:col-span-5 bg-white/5 rounded-2xl border border-white/10 p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-mono text-slate-400">
                    DETERMINISTIC PIPELINE
                  </span>
                  <span className="text-[9px] font-mono text-indigo-400 animate-pulse">
                    RUNNING
                  </span>
                </div>

                <div className="space-y-2.5">
                  {centerpieceSteps.map((s, idx) => {
                    const active = activeCenterpieceStep >= idx;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full transition-all ${active ? "bg-indigo-400 shadow-lg shadow-indigo-400/50 scale-125" : "bg-neutral-800"}`}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span
                              className={
                                active
                                  ? "text-slate-200 font-semibold"
                                  : "text-slate-600"
                              }
                            >
                              {s.label.split(". ")[1]}
                            </span>
                            {active && (
                              <span className="text-emerald-400 text-[8px] font-mono">
                                PASSED
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-neutral-900 h-1 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full bg-indigo-500 transition-all duration-1000 ${active ? "w-full" : "w-0"}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE CORE DIFFERENTIATION: TRADITIONAL VS SAARTHI */}
      <section
        id="architecture"
        className="py-24 border-t border-white/5 bg-[#030303] relative z-10"
      >
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-mono text-indigo-400 tracking-wider uppercase font-semibold">
              The Fundamental Difference
            </h2>
            <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white leading-tight">
              Why Traditional Task Apps Fail You
            </h3>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Standard task apps treat tasks as static text strings and send dumb notifications. Saarthi treats work as a dynamic execution graph and actively repairs your schedule when plans break.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            {/* Traditional Systems */}
            <div className="bg-neutral-950/80 border border-red-500/20 rounded-3xl p-8 space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-md font-bold border border-red-500/20">
                  Traditional Productivity Apps
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Static & Unreactive
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-200">
                The Checklist Collapse Loop
              </h4>

              <div className="space-y-4">
                <div className="p-4 bg-white/2 rounded-2xl border border-white/5 space-y-1">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-400" />
                    1. Delayed Task
                  </div>
                  <p className="text-[11px] text-slate-400">
                    You miss a planned study block or finish a meeting late.
                  </p>
                </div>
                <div className="p-4 bg-white/2 rounded-2xl border border-white/5 space-y-1 opacity-80">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    2. Unchanged Reminders
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Reminders keep firing for impossible times. Notifications turn red.
                  </p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 space-y-1">
                  <div className="text-xs font-bold text-red-400 flex items-center gap-2">
                    <X className="w-4 h-4" />
                    3. Compounding Backlog
                  </div>
                  <p className="text-[11px] text-red-300/80">
                    Overlapping work builds guilt and friction, ending in complete plan abandonment.
                  </p>
                </div>
              </div>
            </div>

            {/* Saarthi Execution OS */}
            <div className="bg-neutral-950/80 border border-indigo-500/30 rounded-3xl p-8 space-y-6 relative overflow-hidden shadow-xl shadow-indigo-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 bg-indigo-500/15 px-2.5 py-0.5 rounded-md font-bold border border-indigo-500/20">
                  Saarthi Execution OS
                </span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Graph-Aware Repair
                </span>
              </div>
              <h4 className="text-xl font-bold text-white">
                Automatic Rescheduling Loop
              </h4>

              <div className="space-y-4">
                <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 space-y-1">
                  <div className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                    1. Delay Detected
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Saarthi identifies the missed task and maps downstream prerequisites (Task A → Task B).
                  </p>
                </div>
                <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20 space-y-1">
                  <div className="text-xs font-bold text-purple-300 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-purple-400" />
                    2. Graph Recalculation
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Kahn's algorithm shifts dependent work, protects HARD deadlines, and moves FLEXIBLE tasks.
                  </p>
                </div>
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 space-y-1">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    3. Calendar & Telegram Sync
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Google Calendar updates non-overlapping slots, and Telegram sends a clear new action plan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORE ENGINES DEEP DIVE */}
      <section id="features" className="py-24 border-t border-white/5 bg-black relative z-10">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-mono text-indigo-400 tracking-wider uppercase font-semibold">
              Engine Breakdown
            </h2>
            <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white">
              Every Engine Built For Execution.
            </h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              No fake marketing promises. Here is how Saarthi's deterministic algorithms and AI models operate together.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1: Prerequisite DAG Engine */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl w-fit border border-indigo-500/20">
                <GitBranch className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Prerequisite DAG Engine
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Task A → Task B → Task C. Powered by Kahn's topological sort and 3-color DFS cycle detection. Automatically elevates prerequisite priorities when dependent work is marked HARD.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: dependencyGraph.ts</span>
                <span className="text-emerald-400">Deterministic</span>
              </div>
            </div>

            {/* Feature 2: Deterministic Time-Boxing */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-2xl w-fit border border-purple-500/20">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Deterministic Time-Boxing
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rules-based subtask slot allocation in 09:00–22:00 working hours. Avoids external busy blocks, guarantees zero subtask overlap, and flags explicit CONFLICT if hard deadlines are breached.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: deterministicSchedulerService.ts</span>
                <span className="text-emerald-400">Deterministic</span>
              </div>
            </div>

            {/* Feature 3: HARD vs FLEXIBLE Commitments */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-2xl w-fit border border-rose-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                HARD vs FLEXIBLE Semantics
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Exams and overdue bills are classified as HARD commitments. During time constraints, FLEXIBLE work shifts downstream so hard deadlines remain 100% protected.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: commitmentSemantics.ts</span>
                <span className="text-emerald-400">Deterministic</span>
              </div>
            </div>

            {/* Feature 4: Multi-Factor Risk Score */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl w-fit border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Multi-Factor Risk Scoring
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculates real-time risk scores (0–100) and zones (SAFE, WATCH, CRITICAL) using velocity diffs, buffer ratios, complexity multipliers (1.35x), and overdue bill penalties (+35).
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: riskEngine.ts</span>
                <span className="text-emerald-400">Deterministic</span>
              </div>
            </div>

            {/* Feature 5: Recovery OS & Compromise Matrix */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit border border-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Recovery OS & Compromise Plans
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a deadline becomes mathematically impossible, Saarthi generates 4 tactical compromise strategies (reduce_scope, delay, split, skip) instead of marking tasks overdue.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: recoveryOsService.ts</span>
                <span className="text-indigo-400">Gemini Flash AI</span>
              </div>
            </div>

            {/* Feature 6: Micro Missions */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-2xl w-fit border border-cyan-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Anti-Procrastination Micro Missions
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Detects execution paralysis on stuck tasks and shrinks friction down to 30-second atomic starter steps (e.g. "Open Chapter 1 page 1") to break initial starting resistance.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: activationEngineService.ts</span>
                <span className="text-indigo-400">Gemini Flash AI</span>
              </div>
            </div>

            {/* Feature 7: Bills & Subscriptions */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-pink-500/10 text-pink-400 rounded-2xl w-fit border border-pink-500/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Bills & Subscription Renewal Engine
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tracks bill lifecycles (UNPAID → OVERDUE → PAID). Unpaid overdue bills impose a strict +35 risk penalty. Automatically generates subscription renewal tasks with zero duplicates.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: commitmentSemantics.ts</span>
                <span className="text-emerald-400">Deterministic</span>
              </div>
            </div>

            {/* Feature 8: Telegram Companion */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl w-fit border border-blue-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Telegram Companion & Pairing
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pairs via secure 6-digit code. Delivers morning briefings (08:00), evening reflections (20:00), and stage-escalated alerts directly to your mobile chat interface.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: telegramBotService.ts</span>
                <span className="text-emerald-400">Telegram API</span>
              </div>
            </div>

            {/* Feature 9: Gemini Live PCM Voice */}
            <div className="bg-neutral-950/60 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group text-left">
              <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-2xl w-fit border border-teal-500/20">
                <Mic className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Gemini Live Voice Coaching
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bidirectional PCM audio WebSocket streaming over `/live`. Talk with Saarthi in real time to reflect on progress or verbalize complex goal breakdowns.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5">
                <span>Location: voiceService.ts & server.ts</span>
                <span className="text-indigo-400">Gemini Live API</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE SIMULATOR: MULTI-FACTOR RISK SCORING */}
      <section
        id="risk-simulator"
        className="py-24 border-t border-white/5 bg-black relative overflow-hidden z-10"
      >
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-mono font-semibold border border-emerald-500/20">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Deterministic Formula
            </div>
            <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white leading-tight">
              Multi-Factor Risk Score Simulator
            </h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Saarthi's risk engine evaluates your progress velocity against timeline elapsed time, remaining capacity buffers, task complexity, commitment semantics, and overdue bills.
            </p>

            <div className="space-y-3 pt-4 border-t border-white/5 text-xs font-mono text-slate-300">
              <div className="flex items-center justify-between p-2 rounded bg-white/5">
                <span>Velocity Penalty:</span>
                <span className="text-indigo-400 font-bold">(Timeline - Progress) × 35 × Weight</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/5">
                <span>Buffer Ratio Penalty:</span>
                <span className="text-indigo-400 font-bold">HoursRemaining / EffortRemaining</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/5">
                <span>Overdue Bill Penalty:</span>
                <span className="text-rose-400 font-bold">+35 Strict Points</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-neutral-950/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl space-y-6 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                <span className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                  Live Risk Engine Output
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Buffer Ratio: {simResult.bufferRatio}x
              </span>
            </div>

            <div className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${
              simResult.zone === "critical"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : simResult.zone === "watch"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}>
              <div>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                  Computed Risk Zone
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-white font-mono">
                    {simResult.score} / 100
                  </span>
                  <span className="text-sm font-bold uppercase tracking-wide">
                    {simResult.zone}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono font-bold text-white">
                  {simResult.zone === "critical"
                    ? "CRITICAL: Urgent Recovery OS Armed"
                    : simResult.zone === "watch"
                    ? "WATCH: Schedule Pressure Detected"
                    : "SAFE: Execution Pacing Optimal"}
                </div>
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Actual Progress:</span>
                  <span className="text-white font-bold">{Math.round(simProgressRatio * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={simProgressRatio}
                  onChange={(e) => setSimProgressRatio(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Hours Remaining:</span>
                  <span className="text-white font-bold">{simHoursLeft} Hours</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="72"
                  value={simHoursLeft}
                  onChange={(e) => setSimHoursLeft(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => setSimIsHard(!simIsHard)}
                  className={`p-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                    simIsHard
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                      : "bg-white/5 border-white/10 text-slate-400"
                  }`}
                >
                  {simIsHard ? "HARD Commitment (+15)" : "FLEXIBLE Commitment"}
                </button>

                <button
                  onClick={() => setSimIsOverdueBill(!simIsOverdueBill)}
                  className={`p-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                    simIsOverdueBill
                      ? "bg-red-500/20 border-red-500/40 text-red-300"
                      : "bg-white/5 border-white/10 text-slate-400"
                  }`}
                >
                  {simIsOverdueBill ? "OVERDUE BILL (+35)" : "Standard Task"}
                </button>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300">
                  Apply Recovery OS Plan Mitigation (-25 points):
                </span>
                <button
                  onClick={() => setSimRecoveryActive(!simRecoveryActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    simRecoveryActive
                      ? "bg-emerald-500 text-black"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {simRecoveryActive ? "ACTIVE" : "OFF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. OCR SHOWCASE SECTION */}
      <section id="ocr" className="py-24 border-t border-white/5 bg-black relative z-10">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 bg-neutral-950 border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl text-left">
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono font-bold text-slate-200">
                    Syllabus OCR Extract Preview
                  </span>
                </div>
                <div className="flex gap-2">
                  {ocrSamples.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setOcrSampleIndex(idx)}
                      className={`px-3 py-1 text-[9px] font-mono rounded-md border transition-all cursor-pointer ${
                        ocrSampleIndex === idx
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-transparent border-white/5 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {ocrSamples[ocrSampleIndex].extracted.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-neutral-900/60 border border-white/5 rounded-2xl space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <h5 className="text-xs font-bold text-white">
                        {c.title}
                      </h5>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                        {c.type} • {c.conf}% conf
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">{c.d}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[9px] font-mono text-slate-500">
                      <span>Due: {new Date(c.deadline).toLocaleString()}</span>
                      <span>Effort: {c.min} mins</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-mono font-semibold border border-indigo-500/20">
                <Upload className="w-3.5 h-3.5" /> Gemini Vision Multimodal
              </div>
              <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white leading-tight">
                Syllabus & Bill OCR Extraction
              </h3>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                Snap a photo of your syllabus, assignment document, or hosting invoice. Gemini Vision parses commitment titles, deadlines, effort estimates, and payment amounts into structured tasks.
              </p>

              <div className="space-y-3 pt-4 border-t border-white/5">
                {[
                  "1. Upload syllabus photo or PDF screenshot.",
                  "2. Gemini Vision extracts structured task items.",
                  "3. Interactive review lets you refine titles & dates.",
                  "4. Deterministic scheduler time-boxes subtasks.",
                ].map((step, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 text-[11px] font-mono text-slate-300"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FINAL CTA */}
      <section className="py-32 border-t border-white/5 bg-gradient-to-b from-black to-neutral-950 relative overflow-hidden z-10 text-center px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-3xl mx-auto space-y-8 relative">
          <h2 className="text-4xl md:text-6xl font-bold font-display tracking-tight text-white leading-tight">
            Stop Planning.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
              Start Executing.
            </span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
            Experience Saarthi—the AI-powered behavioral execution operating system built to govern your commitments and finish the work.
          </p>

          <div className="pt-4">
            <button
              onClick={onLaunch}
              className="px-10 py-5 bg-white text-black hover:bg-slate-200 text-sm font-bold rounded-full transition-all duration-300 cursor-pointer shadow-lg shadow-white/10 inline-flex items-center gap-2 group"
            >
              Start Using Saarthi
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* 9. PREMIUM FOOTER */}
      <footer className="border-t border-white/5 bg-black py-16 text-xs text-slate-500 relative z-10 text-left">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="font-display font-bold text-sm tracking-tight text-white">
                Saarthi
              </span>
            </div>
            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
              Saarthi is a behavioral execution operating system powered by Gemini AI and deterministic execution engines.
            </p>
            <div className="text-[10px] text-slate-600">
              © 2026 Saarthi Platform. All rights reserved.
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-mono text-[10px] text-slate-300 uppercase tracking-wider font-bold">
              Product
            </h5>
            <ul className="space-y-2 text-slate-500">
              <li>
                <button
                  onClick={onLaunch}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Workspace
                </button>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Engine Features
                </a>
              </li>
              <li>
                <a href="#risk-simulator" className="hover:text-white transition-colors">
                  Risk Simulator
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="font-mono text-[10px] text-slate-300 uppercase tracking-wider font-bold">
              Technology
            </h5>
            <ul className="space-y-2 text-slate-500">
              <li>
                <a href="https://ai.google.dev" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Gemini 2.5 Flash
                </a>
              </li>
              <li>
                <a href="https://firebase.google.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Firebase Cloud
                </a>
              </li>
              <li>
                <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Google Calendar API
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="font-mono text-[10px] text-slate-300 uppercase tracking-wider font-bold">
              Architecture
            </h5>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              Kahn's DAG Algorithm • Non-overlapping Time-boxing • Atomic Persistence Engine.
            </div>
          </div>
        </div>
      </footer>

      {/* DEMO MODAL */}
      <AnimatePresence>
        {showDemoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-950 border border-white/10 rounded-3xl max-w-xl w-full p-6 space-y-6 relative text-left shadow-2xl"
            >
              <button
                onClick={() => setShowDemoModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Saarthi Execution Flow</h3>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-mono">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-indigo-400 font-bold">1. User Input:</span> "I have a Chemistry lab due Friday 5 PM and an exam tomorrow."
                </div>
                <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <span className="text-emerald-400 font-bold">2. Risk Engine:</span> Risk Score computed at 78 (CRITICAL) due to exam conflict.
                </div>
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <span className="text-purple-300 font-bold">3. DAG Scheduler:</span> Time-boxes 3 subtask slots around exam blocks in 09:00–22:00 window.
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <span className="text-emerald-300 font-bold">4. Sync & Alert:</span> Subtasks posted to Google Calendar and Telegram bot notified.
                </div>
              </div>

              <button
                onClick={() => {
                  setShowDemoModal(false);
                  onLaunch();
                }}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                Try It In Workspace
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
