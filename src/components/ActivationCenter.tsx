import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Zap,
  Target,
  Clock,
  Check,
  Award,
  AlertCircle,
  PlayCircle,
  ArrowRight,
  PartyPopper
} from "lucide-react";
import { UserAnalytics, ActivationSession, CompanionProfile, Task } from "../types";
import { behavioralIntelligenceService } from "../services/behavioralIntelligenceService";

interface ActivationCenterProps {
  userId: string;
  companionProfile: CompanionProfile | null;
  onExit?: () => void;
  tasks?: any[]; // using any for now since we pass scoredTasks which has .analysis
  onToggleSubtask?: (task: Task, subtaskId: string) => void;
}

export default function ActivationCenter({
  userId,
  companionProfile,
  onExit,
  tasks = [],
  onToggleSubtask
}: ActivationCenterProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    behavioralIntelligenceService.trackEvent({
      userId,
      eventType: "ACTIVATION_STARTED",
      confidence: 100
    });
    // Simulate fetching active friction sessions and momentum analytics
    setTimeout(() => {
      setAnalytics({
        currentStreak: 4,
        status: "Building",
        message: "You've started something every day for 4 days. Keep protecting the habit."
      });
      setIsLoading(false);
    }, 800);
  }, [userId]);

  const handleExit = () => {
    if (!activated) {
      behavioralIntelligenceService.trackEvent({
        userId,
        eventType: "ACTIVATION_ABANDONED",
        confidence: 100
      });
    } else {
      behavioralIntelligenceService.trackEvent({
        userId,
        eventType: "ACTIVATION_COMPLETED",
        confidence: 100
      });
    }
    onExit?.();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Find the first critical task that still has unfinished subtasks
  const activeCriticalTask = tasks.find(t => {
    const isCritical = t.riskZone === "critical" || t.analysis?.zone === "critical";
    const hasUnfinished = t.subtasks?.some((s: any) => !s.done);
    return isCritical && hasUnfinished;
  });

  const isCompleted = !activeCriticalTask;
  
  let currentMission = null;
  let missionTitle = "No Active Mission";
  let missionTotalMinutes = 0;
  let currentStepIndex = 0;
  let totalSteps = 0;
  let activeSubtask = null;

  if (activeCriticalTask) {
    missionTitle = activeCriticalTask.title;
    missionTotalMinutes = activeCriticalTask.totalEffortMinutes;
    totalSteps = activeCriticalTask.subtasks.length;
    currentStepIndex = activeCriticalTask.subtasks.findIndex((s: any) => !s.done);
    
    if (currentStepIndex !== -1) {
      activeSubtask = activeCriticalTask.subtasks[currentStepIndex];
      currentMission = {
        title: activeSubtask.title,
        desc: "Focus purely on this one small step.",
        estimatedSeconds: (activeSubtask.estimatedMinutes || 2) * 60,
      };
    }
  }

  return (
    <div className="w-full flex flex-col h-full animate-in fade-in duration-300 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
        {/* Main Active Panel */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 p-8 relative overflow-hidden h-full flex flex-col shadow-sm">
            <div className="absolute top-0 right-0 p-32 bg-amber-500/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            
            {isCompleted ? (
              <div className="text-center py-12 relative z-10 flex-grow flex flex-col items-center justify-center">
                <div className="mx-auto w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-full border border-emerald-100 dark:border-emerald-800 flex items-center justify-center mb-6">
                  <PartyPopper className="h-10 w-10 text-emerald-500" />
                </div>
                <h3 className="text-3xl font-black text-zinc-900 dark:text-white mb-3 tracking-tight">Barrier Broken</h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto text-base leading-relaxed mb-8">
                  You successfully overcame the friction and got started. All critical blockers are cleared.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button 
                    onClick={handleExit}
                    className="w-full sm:w-auto px-6 py-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border border-zinc-200 dark:border-zinc-700/50"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Ready?</span>
                  </div>
                  
                  {/* Progress Dots */}
                  <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700/50">
                    {activeCriticalTask.subtasks.map((_: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentStepIndex 
                            ? "bg-amber-500" 
                            : idx < currentStepIndex 
                              ? "bg-emerald-500" 
                              : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 ml-2">
                      Step {currentStepIndex + 1} of {totalSteps}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 mb-8 opacity-50 grayscale">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Today's Mission</p>
                  <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100 line-through decoration-zinc-400">{missionTitle}</p>
                  <div className="flex items-center gap-1.5 text-zinc-500 text-sm">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Estimated: {Math.floor(missionTotalMinutes / 60)}h {missionTotalMinutes % 60}m</span>
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl p-6 mb-8 relative">
                  <div className="absolute -top-3 left-6 bg-zinc-900 text-zinc-100 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full shadow-sm">
                    Your Only Goal
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 mt-2">
                    {currentMission?.desc}
                  </p>
                  <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
                    {currentMission?.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Estimated: <strong className="text-zinc-900 dark:text-zinc-100">{currentMission?.estimatedSeconds} seconds</strong></span>
                  </div>
                </div>

                <div className="mt-auto flex justify-center w-full">
                  {!activated ? (
                    <button
                      onClick={() => setActivated(true)}
                      className="w-full sm:w-auto px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-zinc-900/10 cursor-pointer"
                    >
                      <PlayCircle className="w-5 h-5" />
                      I'm Ready
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                      <button 
                        onClick={() => {
                          if (onToggleSubtask && activeSubtask) {
                            onToggleSubtask(activeCriticalTask, activeSubtask.id);
                          }
                          setActivated(false);
                        }}
                        className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 cursor-pointer transition-all"
                      >
                        <Check className="w-5 h-5" />
                        {currentStepIndex === totalSteps - 1 ? "Finish Series" : "Done. Next Step"}
                      </button>
                      <button 
                        onClick={handleExit}
                        className="w-full sm:w-auto px-6 py-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        Exit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side Panel: Emotional Momentum */}
        <div className="space-y-6 flex flex-col">
          <div className="bg-zinc-900 text-zinc-100 rounded-3xl p-8 relative overflow-hidden flex-1 flex flex-col justify-center">
            <div className="absolute top-0 right-0 p-32 bg-amber-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Momentum</h2>
            
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🔥</span>
              <h3 className="text-2xl font-black tracking-tight">{analytics?.status || "Building"}</h3>
            </div>
            
            <p className="text-zinc-400 leading-relaxed font-medium">
              {analytics?.message || "Keep protecting the habit."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
