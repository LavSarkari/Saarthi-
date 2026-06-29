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
      label: "1. Raw Commitment",
      title: "Deconstruct the Overwhelming",
      desc: "Upload a syllabus screenshot, assignment handout, or dictate 'I have a math final next Friday'.",
      color: "from-blue-500 to-indigo-500",
      icon: Camera,
      status: "Analyzing raw input...",
      confidence: "Scanning...",
    },
    {
      label: "2. AI Task Decomposition",
      title: "Step-by-Step Strategic Roadmap",
      desc: "Saarthi breaks commitments down into bite-sized operational subtasks with strict recommended minute allotments.",
      color: "from-indigo-500 to-purple-500",
      icon: Layers,
      status: "Decomposing to 5 subtasks",
      confidence: "Planning Complete",
    },
    {
      label: "3. Real-Time Risk Profiling",
      title: "Predictive Deadline Engine",
      desc: "Our risk engine evaluates hours remaining, task complexity, and schedules to compute a Completion Confidence score.",
      color: "from-pink-500 to-rose-500",
      icon: AlertTriangle,
      status: "Risk Score: 78% (Caution)",
      confidence: "Dynamic Evaluation",
    },
    {
      label: "4. Autonomous Recovery Engine",
      title: "Action-Oriented Compromise Plans",
      desc: "If a conflict occurs, Saarthi drafts precise visual compromise strategies to help you cross the finish line.",
      color: "from-amber-500 to-emerald-500",
      icon: ArrowRightLeft,
      status: "Compromise Plan: Ready",
      confidence: "Recovery Armed",
    },
    {
      label: "5. Execution & Calendar Sync",
      title: "Seamless Real-World Sync",
      desc: "Subtasks automatically write back to your Google Calendar and Google Tasks, creating unified accountability.",
      color: "from-emerald-400 to-teal-500",
      icon: CheckCircle2,
      status: "Synced with Google Calendar",
      confidence: "100% Secured",
    },
  ];

  // Auto-play centerpiece steps
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCenterpieceStep((prev) => (prev + 1) % centerpieceSteps.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Signature Innovation: Completion Confidence Slider Simulator
  const [simTasksCount, setSimTasksCount] = useState(4);
  const [simHoursLeft, setSimHoursLeft] = useState(48);
  const [simComplexity, setSimComplexity] = useState(3); // 1-5 scale
  const [simSleep, setSimSleep] = useState(7); // 4-10 scale
  const [simRecoveryActive, setSimRecoveryActive] = useState(false);

  // Compute simulated confidence score
  const calculateSimulatedConfidence = () => {
    // base confidence is 100
    let score = 100;
    // more tasks reduce confidence
    score -= simTasksCount * 6;
    // less hours left reduces confidence drastically
    if (simHoursLeft < 12) score -= 45;
    else if (simHoursLeft < 24) score -= 25;
    else if (simHoursLeft < 72) score -= 10;

    // high complexity reduces confidence
    score -= (simComplexity - 1) * 8;
    // poor sleep reduces confidence
    if (simSleep < 6) score -= (6 - simSleep) * 12;

    // if recovery is armed, restore confidence by 30%
    if (simRecoveryActive) {
      score = Math.min(98, score + 28);
    }

    return Math.max(5, Math.min(100, Math.round(score)));
  };

  const simConfidence = calculateSimulatedConfidence();
  const getSimZone = (score: number) => {
    if (score >= 80)
      return {
        label: "Secured",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
      };
    if (score >= 50)
      return {
        label: "Caution",
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
      };
    return {
      label: "High Risk",
      color: "text-rose-400",
      bg: "bg-rose-500/10 border-rose-500/20",
    };
  };
  const simZone = getSimZone(simConfidence);

  // OCR Showcase interactive sample selection
  const [ocrSampleIndex, setOcrSampleIndex] = useState(0);
  const ocrSamples = [
    {
      title: "CS 311 Syllabus.png",
      date: "Oct 12, 2026",
      extracted: [
        {
          title: "Database Architecture Midterm",
          deadline: "2026-10-15T10:00",
          d: "Chapters 1-6 coverage.",
          min: 180,
          conf: 98,
        },
        {
          title: "Relational Algebra Problem Set",
          deadline: "2026-10-18T23:59",
          d: "SQL parsing questions.",
          min: 120,
          conf: 95,
        },
      ],
    },
    {
      title: "Exam_Schedule_Winter.jpg",
      date: "Dec 04, 2026",
      extracted: [
        {
          title: "Calculus III Final Assessment",
          deadline: "2026-12-08T09:00",
          d: "Multivariable integration focus.",
          min: 300,
          conf: 91,
        },
        {
          title: "Linear Algebra Lab Sync",
          deadline: "2026-12-05T17:00",
          d: "Matlab vector transforms.",
          min: 90,
          conf: 88,
        },
      ],
    },
  ];

  // Demo Video/Walkthrough Modal State
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const demoConversation = [
    {
      sender: "user",
      text: "Hey Saarthi, I have a massive Chemistry lab report due on Friday at 5 PM. I haven't started yet and I have an exam tomorrow.",
    },
    {
      sender: "assistant",
      text: "I have calculated your Completion Confidence at 42% (High Risk) due to the tomorrow exam conflict. Let's establish a strict 3-step tactical recovery plan: 1. Core Synthesis (90m tonight), 2. Visual Graphs Mapping (60m Friday morning), 3. Executive Review (30m before submit). Let me schedule this safely around your exam slot.",
    },
    { sender: "user", text: "That sounds completely doable. Lock that in." },
    {
      sender: "assistant",
      text: "Perfect. Recovery route locked. Subtasks written to Google Tasks and synced with Google Calendar. Your Completion Confidence has risen to 88% (Secured). Let's nail this.",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-slate-100 font-sans selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      {/* Dynamic Aurora Atmospheric Glow Backgrounds */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[500px] rounded-full bg-gradient-to-tr from-indigo-600/10 to-transparent blur-[160px] pointer-events-none" />
      <div className="absolute top-[20%] right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-purple-600/5 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-10 w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-pink-600/5 to-transparent blur-[180px] pointer-events-none" />

      {/* Decorative Grid Mesh */}
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
              </div>
              {!isScrolled && (
                <span className="text-[9px] text-slate-500 font-medium tracking-tight mt-0.5">
                  Syllabus & Deadline Execution
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-[11px] font-mono tracking-widest uppercase text-slate-400">
              <a
                href="#problem"
                className="hover:text-white transition-colors relative group py-2"
              >
                Philosophy
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
                href="#innovation"
                className="hover:text-white transition-colors relative group py-2"
              >
                Confidence Engine
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="#ocr"
                className="hover:text-white transition-colors relative group py-2"
              >
                OCR Import
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 transition-all duration-300 group-hover:w-full"></span>
              </a>
            </nav>

            {/* CTA Button */}
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
        {/* Flagship Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-indigo-400 tracking-wider uppercase">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
          </span>
          Google AI Studio Hackathon Flagship
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-7xl font-bold font-display tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          The Last-Minute <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
            Life Saver.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-slate-400 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed">
          Saarthi is an AI-powered productivity companion that proactively
          assists you in planning, prioritizing, and completing tasks before
          deadlines are missed.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onLaunch}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-sm font-bold text-white rounded-full transition-all duration-300 shadow-xl shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2 group"
          >
            Launch Saarthi
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => setShowDemoModal(true)}
            className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-white rounded-full transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-3.5 h-3.5 text-indigo-400" />
            Watch AI Demo
          </button>
        </div>

        {/* HERO VISUAL: The interactive centerpiece node cycle */}
        <div className="pt-12 max-w-4xl mx-auto">
          <div className="bg-neutral-950/40 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-xl relative shadow-2xl">
            {/* Ambient inner neon glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-10 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none" />

            {/* Step Navigation Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-white/5 pb-6">
              {centerpieceSteps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = activeCenterpieceStep === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveCenterpieceStep(idx)}
                    className={`flex flex-col items-center p-3 rounded-2xl transition-colors duration-200 cursor-pointer text-center space-y-1.5 border ${
                      isActive
                        ? "bg-white/5 border-white/10 shadow-lg"
                        : "border-transparent hover:bg-white/2"
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
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Showcase Visual Pane */}
            <div className="py-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center text-left min-h-[300px]">
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
                      <span>Engine State:</span>
                      <span className="uppercase text-white animate-pulse">
                        {centerpieceSteps[activeCenterpieceStep].status}
                      </span>
                    </div>
                    <h3 className="text-xl md:text-3xl font-bold tracking-tight text-white font-display">
                      {centerpieceSteps[activeCenterpieceStep].title}
                    </h3>
                    <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                      {centerpieceSteps[activeCenterpieceStep].desc}
                    </p>

                    <div className="pt-2 flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-500">
                        Security Index:
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                        {centerpieceSteps[activeCenterpieceStep].confidence}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Graphical Visual Mockup */}
              <div className="md:col-span-5 bg-white/2 rounded-2xl border border-white/5 p-6 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-transparent blur-md pointer-events-none" />

                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-mono text-slate-400">
                    ACTIVE TASK PIPELINE
                  </span>
                  <span className="text-[9px] font-mono text-indigo-400 animate-pulse">
                    LIVE
                  </span>
                </div>

                {/* Simulated Pipeline Stages Visual */}
                <div className="space-y-3">
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
                                OK
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

      {/* 2. CORE PROBLEM COMPARISON */}
      <section
        id="problem"
        className="py-24 border-t border-white/5 bg-[#030303] relative z-10"
      >
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-mono text-indigo-400 tracking-wider uppercase font-semibold">
              The Productivity Crisis
            </h2>
            <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white">
              Reminders Don't Solve Procrastination.
            </h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Modern calendar pings and checklists assume humans are robots.
              When friction spikes or schedules overflow, traditional systems
              fail completely. Saarthi provides a dynamic protective system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
            {/* Traditional Systems */}
            <div className="bg-neutral-950/60 border border-red-500/10 rounded-3xl p-8 space-y-6 relative overflow-hidden group hover:border-red-500/20 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-md font-bold">
                  Traditional Apps
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Unreactive Alerts
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-200">
                The Screen Fatigue Spiral
              </h4>

              {/* Traditional Flow Visualization */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white/2 rounded-xl border border-white/5 opacity-80">
                  <div className="p-1.5 bg-neutral-900 rounded text-rose-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-300">
                      Unstructured Reminder
                    </h5>
                    <p className="text-[10px] text-slate-500">
                      A generic notification states: "Database Project Due
                      tomorrow."
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white/2 rounded-xl border border-white/5 opacity-60">
                  <div className="p-1.5 bg-neutral-900 rounded text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-300">
                      Ignored Due to Friction
                    </h5>
                    <p className="text-[10px] text-slate-500">
                      You ignore it because starting is overwhelming and
                      undefined.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                  <div className="p-1.5 bg-red-500/10 rounded text-red-400">
                    <X className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-red-400">
                      Sudden Panic & Missed Deadline
                    </h5>
                    <p className="text-[10px] text-red-400/80">
                      Last-minute rush leads to severe fatigue, low quality, or
                      failure.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Saarthi Premium AI System */}
            <div className="bg-neutral-950/60 border border-indigo-500/20 rounded-3xl p-8 space-y-6 relative overflow-hidden group hover:border-indigo-500/40 transition-all shadow-xl shadow-indigo-950/20">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 bg-indigo-500/15 px-2.5 py-0.5 rounded-md font-bold">
                  Saarthi Execution Engine
                </span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
                  Predictive AI
                </span>
              </div>
              <h4 className="text-xl font-bold text-white">
                Continuous Execution Guidance
              </h4>

              {/* Saarthi Flow Visualization */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                  <div className="p-1.5 bg-indigo-500/10 rounded text-indigo-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-indigo-300">
                      Automated Deconstruction
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      AI parses the project into 4 action steps with suggested
                      effort.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-400">
                    <TrendingUp className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-emerald-300">
                      Completion Confidence Tracker
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      Computes real-time execution risk based on your schedule.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-purple-500/5 rounded-xl border border-purple-500/10">
                  <div className="p-1.5 bg-purple-500/10 rounded text-purple-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-purple-300">
                      Compromise & Rescue Strategy
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      Flags overload conflicts and suggests custom operational
                      recoveries.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE SIGNATURE INNOVATION: COMPLETION CONFIDENCE */}
      <section
        id="innovation"
        className="py-24 border-t border-white/5 bg-black relative overflow-hidden z-10"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/5 blur-[150px] rounded-full pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-mono font-semibold">
              <Zap className="w-3 h-3 text-emerald-400" /> Signature Algorithm
            </div>
            <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white leading-tight">
              Completion Confidence
            </h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Our core algorithm continuously profiles the feasibility of your
              commitments. Adjust the simulation variables to see how Saarthi
              dynamically protects your on-time execution.
            </p>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex gap-3 items-start">
                <div className="p-1 bg-white/5 rounded mt-0.5 text-indigo-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    Execution Velocity Index
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Tracks how fast you complete micro-tasks versus deadlines.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="p-1 bg-white/5 rounded mt-0.5 text-indigo-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    Recovery Impact Safeguard
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Restores confidence immediately once a structured tactical
                    rescue plan is accepted.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Slider driven Simulator Panel */}
          <div className="lg:col-span-7 bg-neutral-950/60 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl space-y-8 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                <span className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
                  Dynamic Risk Simulator
                </span>
              </div>
              <button
                onClick={() => {
                  setSimTasksCount(4);
                  setSimHoursLeft(48);
                  setSimComplexity(3);
                  setSimSleep(7);
                  setSimRecoveryActive(false);
                }}
                className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            {/* Simulated Live Output Card */}
            <div
              className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${simZone.bg}`}
            >
              <div className="text-center md:text-left space-y-1">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                  Computed Feasibility Zone
                </span>
                <div className="flex items-baseline gap-2 justify-center md:justify-start">
                  <span className="text-3xl font-black text-white font-mono">
                    {simConfidence}%
                  </span>
                  <span className={`text-xs font-bold ${simZone.color}`}>
                    {simZone.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 max-w-[280px]">
                  {simConfidence >= 80
                    ? "Safe buffer space. Subtasks mapped cleanly."
                    : simConfidence >= 50
                      ? "Subtasks high density. Strategic recovery recommended."
                      : "Severe conflict! Immediate tactical rescue plan required."}
                </p>
              </div>

              {/* Progress Ring or Circular gauge simulation */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <path
                    className="text-white/5"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`transition-all duration-500 ${
                      simConfidence >= 80
                        ? "text-emerald-500"
                        : simConfidence >= 50
                          ? "text-amber-500"
                          : "text-rose-500"
                    }`}
                    strokeDasharray={`${simConfidence}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xs font-mono font-bold text-white">
                    {simConfidence}%
                  </span>
                </div>
              </div>
            </div>

            {/* Sliders Control Panel */}
            <div className="space-y-4">
              {/* Task Density Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">
                    Incomplete Commitment Steps:
                  </span>
                  <span className="text-white font-bold">
                    {simTasksCount} steps
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={simTasksCount}
                  onChange={(e) => setSimTasksCount(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Time Buffer Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">
                    Hours Remaining Until Due:
                  </span>
                  <span className="text-white font-bold">
                    {simHoursLeft} Hours
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="120"
                  step="6"
                  value={simHoursLeft}
                  onChange={(e) => setSimHoursLeft(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Complexity Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Task Complexity:</span>
                    <span className="text-white font-bold">
                      Lvl {simComplexity}/5
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={simComplexity}
                    onChange={(e) => setSimComplexity(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Sleep/Cognitive buffer slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">
                      Pre-Exam Sleep Buffer:
                    </span>
                    <span className="text-white font-bold">
                      {simSleep} Hours
                    </span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="10"
                    value={simSleep}
                    onChange={(e) => setSimSleep(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Activate Strategic Recovery Checkbox */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between bg-white/2 p-3.5 rounded-xl border border-white/5">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">
                    Arm Strategic Compromise Recovery Plan
                  </span>
                  <p className="text-[10px] text-slate-400">
                    Redistributes focus tasks to secure the absolute baseline
                    passing threshold.
                  </p>
                </div>
                <button
                  onClick={() => setSimRecoveryActive(!simRecoveryActive)}
                  className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-300 ${simRecoveryActive ? "bg-emerald-500" : "bg-neutral-800"}`}
                  aria-label="Toggle Strategic Compromise Recovery Plan"
                  role="switch"
                  aria-checked={simRecoveryActive}
                >
                  <div
                    className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-300 ${simRecoveryActive ? "translate-x-5" : ""}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PREMIUM FEATURE SHOWCASE */}
      <section
        id="features"
        className="py-24 border-t border-white/5 bg-[#030303] relative z-10"
      >
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-mono text-indigo-400 tracking-wider uppercase font-semibold">
              The Saarthi Toolbox
            </h2>
            <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white">
              Every Tool Formed For Execution.
            </h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              We ditched generic lists. Every single feature inside Saarthi
              integrates directly with Google models to reduce initial cognitive
              drag.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-neutral-950/40 border border-white/5 rounded-3xl p-6 space-y-4 hover:border-indigo-500/20 hover:bg-neutral-950/80 transition-all group">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl w-fit">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                AI-Powered Scheduling Assistance
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Breaks raw qualitative goals into logical subtasks.
                Automatically scales estimates using the Gemini reasoning model
                to fit your schedule.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-neutral-950/40 border border-white/5 rounded-3xl p-6 space-y-4 hover:border-indigo-500/20 hover:bg-neutral-950/80 transition-all group">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-2xl w-fit">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                Intelligent Task Prioritization
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Continually computes an active score based on deadlines,
                remaining workload, and cognitive factors to dynamically
                prioritize critical tasks.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-neutral-950/40 border border-white/5 rounded-3xl p-6 space-y-4 hover:border-indigo-500/20 hover:bg-neutral-950/80 transition-all group">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-2xl w-fit">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                Personalized Productivity Recommendations
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a conflict is detected, click one button to compile
                immediate tactical rescue strategies and actionable compromises.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-neutral-950/40 border border-white/5 rounded-3xl p-6 space-y-4 hover:border-indigo-500/20 hover:bg-neutral-950/80 transition-all group">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl w-fit">
                <Camera className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                Autonomous Task Planning & Execution
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan multiple syllabus deadlines directly from images using
                Gemini Vision for structured import and fully autonomous
                scheduling.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-neutral-950/40 border border-white/5 rounded-3xl p-6 space-y-4 hover:border-indigo-500/20 hover:bg-neutral-950/80 transition-all group">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                Calendar Integration & Goal Tracking
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real OAuth linkage connects your active tasks to Google Calendar
                and Google Tasks, creating unified goal tracking and
                accountability.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-neutral-950/40 border border-white/5 rounded-3xl p-6 space-y-4 hover:border-indigo-500/20 hover:bg-neutral-950/80 transition-all group">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl w-fit">
                <Mic className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                Voice-Enabled Assistance & Context Reminders
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Engage in real-time voice consultations with tactical AI
                coaches. Get context-aware reminders that adapt to your progress
                and stress levels.
              </p>
            </div>

            {/* Feature 7 */}
            <div className="bg-neutral-950/40 border border-white/5 rounded-3xl p-6 space-y-4 hover:border-indigo-500/20 hover:bg-neutral-950/80 transition-all group md:col-span-2 lg:col-span-1">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-2xl w-fit">
                <MessageCircle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                Telegram Companion Bot
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Get high-priority alerts via a dedicated Telegram bot. Receive
                quick-start templates and immediate execution steps without
                opening the app.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. OCR SHOWCASE SECTION */}
      <section
        id="ocr"
        className="py-24 border-t border-white/5 bg-black relative z-10"
      >
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Visual Screen on Left */}
            <div className="lg:col-span-7 bg-neutral-950 border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent blur-xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono font-bold text-slate-200">
                    Syllabus OCR Extract Preview
                  </span>
                </div>
                {/* Switcher */}
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

              {/* Displaying extracted sample data with confidence mapping */}
              <div className="space-y-4">
                <div className="p-4 bg-white/2 border border-white/5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">
                      File Legibility Verification
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Scanned on {ocrSamples[ocrSampleIndex].date}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full font-bold">
                    96% Confidence Match
                  </span>
                </div>

                <div className="space-y-3">
                  <span className="text-[9px] font-mono text-slate-500 block uppercase">
                    Extracted Commitments
                  </span>
                  {ocrSamples[ocrSampleIndex].extracted.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-neutral-900/60 border border-white/5 rounded-2xl space-y-2 hover:border-indigo-500/20 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <h5 className="text-xs font-bold text-white">
                          {c.title}
                        </h5>
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/5 px-2 py-0.5 rounded">
                          {c.conf}% conf
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">{c.d}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[9px] font-mono text-slate-500">
                        <span>
                          Due: {new Date(c.deadline).toLocaleString()}
                        </span>
                        <span>Effort: {c.min} mins</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Title / Description on Right */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-mono font-semibold">
                <Upload className="w-3.5 h-3.5" /> High-Fidelity vision
              </div>
              <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white leading-tight">
                OCR Commitment Import
              </h3>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                Don't waste time typing lengthy syllabus details or copy-pasting
                homework guidelines. Snap a quick photo with your phone or
                drag-and-drop screenshots of documents.
              </p>

              {/* Progress Stepper representation */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                {[
                  "1. Upload syllabus/exam sheet screenshot.",
                  "2. Gemini Vision extracts multiple commitments with confidence levels.",
                  "3. Interactive review layout allows instant title or date modifications.",
                  "4. Commitments instantly decompose and schedule inside Saarthi.",
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

      {/* 6. GOOGLE AI ARCHITECTURE INTEGRATION */}
      <section
        id="google"
        className="py-24 border-t border-white/5 bg-[#030303] relative z-10"
      >
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-mono text-indigo-400 tracking-wider uppercase font-semibold">
              Under the Hood
            </h2>
            <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white">
              Google Cloud & Gemini Synergy.
            </h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Saarthi is fully built within the Google Cloud Run ecosystem,
              incorporating real-time AI and durable storage architectures.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl space-y-3 hover:border-indigo-500/10 transition-all">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider block font-bold">
                Primary Model
              </span>
              <h4 className="text-base font-bold text-slate-200">
                Gemini 3.5 Flash
              </h4>
              <p className="text-xs text-slate-400">
                Powers real-time decomposition and tactical task strategy
                generation with high logical throughput.
              </p>
            </div>

            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl space-y-3 hover:border-indigo-500/10 transition-all">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider block font-bold">
                Vision Engine
              </span>
              <h4 className="text-base font-bold text-slate-200">
                Gemini Vision (OCR)
              </h4>
              <p className="text-xs text-slate-400">
                Scans complicated PDFs, lecture slides, and physical documents
                to read and structure target dates.
              </p>
            </div>

            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl space-y-3 hover:border-indigo-500/10 transition-all">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider block font-bold">
                Live Consultation
              </span>
              <h4 className="text-base font-bold text-slate-200">
                Gemini Live API
              </h4>
              <p className="text-xs text-slate-400">
                Establishes bidirectional PCM voice WebSockets for natural
                spoken productivity reviews.
              </p>
            </div>

            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl space-y-3 hover:border-indigo-500/10 transition-all">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider block font-bold">
                Real-time DB
              </span>
              <h4 className="text-base font-bold text-slate-200">
                Firebase & Firestore
              </h4>
              <p className="text-xs text-slate-400">
                Persists user commitments, historical activity, and settings
                with low-latency client subscriptions.
              </p>
            </div>

            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl space-y-3 hover:border-indigo-500/10 transition-all">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider block font-bold">
                Secure Access
              </span>
              <h4 className="text-base font-bold text-slate-200">
                Firebase Authentication
              </h4>
              <p className="text-xs text-slate-400">
                Safeguards private schedules with encrypted OAuth credentials
                and direct profile mapping.
              </p>
            </div>

            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl space-y-3 hover:border-indigo-500/10 transition-all">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider block font-bold">
                Integrations
              </span>
              <h4 className="text-base font-bold text-slate-200">
                Google Calendar & Tasks
              </h4>
              <p className="text-xs text-slate-400">
                Direct write-back integrations provide standard synchronization
                with default calendar screens.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. BENTO DASHBOARD PREVIEW */}
      <section className="py-24 border-t border-white/5 bg-black relative z-10">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-mono text-indigo-400 tracking-wider uppercase font-semibold">
              Visual Interface
            </h2>
            <h3 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-white">
              The Command Center.
            </h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Explore the clean, data-dense layout of the Saarthi Workspace
              designed for desktop-first clarity and performance.
            </p>
          </div>

          {/* Bento Grid Preview Mockup */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Bento Grid Card 1: Confidence Score */}
            <div className="md:col-span-4 bg-neutral-950 border border-white/5 rounded-3xl p-6 flex flex-col justify-between space-y-8 relative overflow-hidden">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider block font-bold">
                  Active Engine
                </span>
                <h4 className="text-base font-bold text-slate-200">
                  Average Confidence
                </h4>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-5xl font-black text-white font-mono">
                  84%
                </span>
                <div>
                  <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> +12% this week
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Recovery plans active.
                  </p>
                </div>
              </div>
            </div>

            {/* Bento Grid Card 2: Upcoming Deadlines */}
            <div className="md:col-span-8 bg-neutral-950 border border-white/5 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Tracked Commitments
                </span>
                <span className="text-[9px] font-mono text-indigo-400">
                  3 ACTIVE
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-white/2 rounded-xl">
                  <div>
                    <h5 className="text-xs font-bold text-white">
                      Database Normalization Homework
                    </h5>
                    <p className="text-[9px] text-slate-500">
                      Decomposed to 4 items.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">
                    High Priority
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-white/2 rounded-xl">
                  <div>
                    <h5 className="text-xs font-bold text-white">
                      Advanced Calculus Exam Review
                    </h5>
                    <p className="text-[9px] text-slate-500">
                      Timed interval calendar sync.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                    Secured
                  </span>
                </div>
              </div>
            </div>

            {/* Bento Grid Card 3: Active Coach Tab */}
            <div className="md:col-span-7 bg-neutral-950 border border-white/5 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Live Advisor Feed
                </span>
                <span className="text-[9px] font-mono text-indigo-400">
                  COACH ACTIVE
                </span>
              </div>

              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                <p className="text-xs text-indigo-300 italic">
                  "Calculus test has high task density. I have carved out a
                  90-minute block on Friday morning for final synthesis. Your
                  calendar is clear."
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">
                    S
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">
                    Saarthi Strategic Advisor
                  </span>
                </div>
              </div>
            </div>

            {/* Bento Grid Card 4: Stats */}
            <div className="md:col-span-5 bg-neutral-950 border border-white/5 rounded-3xl p-6 flex flex-col justify-between space-y-4">
              <span className="text-[10px] font-mono text-slate-400 uppercase border-b border-white/5 pb-2 block">
                Sync Pipelines
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/2 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500">
                    Google Calendar
                  </span>
                  <div className="text-xs font-bold text-emerald-400">
                    Active (Sync)
                  </div>
                </div>
                <div className="p-3 bg-white/2 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500">
                    Google Tasks
                  </span>
                  <div className="text-xs font-bold text-emerald-400">
                    Active (Sync)
                  </div>
                </div>
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
            Your Deadlines Already Have a Date. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
              Your Success Should Too.
            </span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
            Break free from the stressful alarm schedules. Start planning with
            proactive AI support and lock down your goals today.
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
      <footer className="border-t border-white/5 bg-black py-16 text-xs text-slate-500 relative z-10">
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
              Saarthi is an advanced AI Execution Partner created for
              high-stress academic and professional workflows. Built on the
              Google Cloud platform.
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
                  Launch Workspace
                </button>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-white transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#innovation"
                  className="hover:text-white transition-colors"
                >
                  Confidence Algorithm
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
                <a
                  href="https://ai.google.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Gemini 3.5
                </a>
              </li>
              <li>
                <a
                  href="https://firebase.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Firebase Cloud
                </a>
              </li>
              <li>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Google Calendar API
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="font-mono text-[10px] text-slate-300 uppercase tracking-wider font-bold">
              Developer
            </h5>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              Designed as a flagship Google AI submission for extreme
              productivity enablement.
            </div>
          </div>
        </div>
      </footer>

      {/* WATCH DEMO WALKTHROUGH MODAL */}
      <AnimatePresence>
        {showDemoModal && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[200]">
            {/* Backdrop blur layer sibling */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
              onClick={() => {
                setShowDemoModal(false);
                setDemoStep(0);
              }}
            />
            {/* Modal box (relative z-10 to stay crisp and above the blur) */}
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="relative z-10 bg-neutral-950 border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Simulated AI Voice Walkthrough
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowDemoModal(false);
                    setDemoStep(0);
                  }}
                  className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Simulation Area */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto p-2">
                {demoConversation.slice(0, demoStep + 1).map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                      {msg.sender === "user" ? "You" : "Saarthi Advisor"}
                    </span>
                    <div
                      className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-white/5 text-slate-200 rounded-tl-none border border-white/5"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Stepper Control */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-[10px] font-mono text-slate-500">
                  Dialogue {demoStep + 1} of {demoConversation.length}
                </span>
                <div className="flex gap-2">
                  {demoStep < demoConversation.length - 1 ? (
                    <button
                      onClick={() => setDemoStep((prev) => prev + 1)}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                    >
                      Next Response →
                    </button>
                  ) : (
                    <button
                      onClick={onLaunch}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                    >
                      Try Workspace Now!
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
