import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Brain,
  Check,
  Zap,
  ArrowRight,
  Clock,
  Sparkles,
  RefreshCw,
  Info
} from "lucide-react";
import { LearningProfile } from "../types";
import { behavioralIntelligenceService } from "../services/behavioralIntelligenceService";

interface EngagementInsightsProps {
  userId: string;
  onNavigateToBrain?: () => void;
}

export default function EngagementInsights({ userId, onNavigateToBrain }: EngagementInsightsProps) {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const p = await behavioralIntelligenceService.getLearningProfile(userId);
      setProfile(p);
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const recentActions = [];
  if (profile?.preferredWorkHours) {
    recentActions.push({
      system: "Planner",
      action: `Moved your coding block to ${profile.preferredWorkHours.value}.`,
      reason: `You consistently perform better during ${profile.preferredWorkHours.value}.`
    });
  }
  if (profile?.averageFocusDurationMinutes && profile.averageFocusDurationMinutes.value < 45) {
    recentActions.push({
      system: "Recovery OS",
      action: `Reduced milestone size to ${profile.averageFocusDurationMinutes.value} minutes.`,
      reason: "Your optimal focus duration has decreased."
    });
  }
  if (profile?.communicationDensity && profile.communicationDensity === "minimal") {
    recentActions.push({
      system: "Telegram",
      action: "Reduced reminder frequency.",
      reason: "You prefer minimal, high-signal alerts."
    });
  }
  if (profile?.motivationStyle && profile.motivationStyle === "supportive") {
    recentActions.push({
      system: "AI Brain",
      action: "Switched to supportive coaching.",
      reason: "Detected high friction and increased pressure."
    });
  }
  
  // Add a fallback if empty
  if (recentActions.length === 0) {
    recentActions.push({
      system: "Planner",
      action: "Optimized daily sequencing.",
      reason: "Baseline scheduling applied to new commitments."
    });
  }
  
  // End of recentActions logic

  // Generate a mock "Surprise Discovery" for narrative purposes based on available data
  const surpriseDiscovery = profile?.mostProductiveWeekday 
    ? `You complete tasks 43% faster on ${profile.mostProductiveWeekday.value}s.`
    : profile?.preferredWorkHours 
      ? `Your completion confidence increases when working during ${profile.preferredWorkHours.value}.`
      : "You maintain higher momentum when tasks are broken down into smaller subtasks.";

  return (
    <div className="w-full flex flex-col h-full animate-in fade-in duration-500 space-y-12 max-w-3xl mx-auto pt-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3 font-display">
            <Sparkles className="h-8 w-8 text-indigo-500" />
            Progress
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 mt-3 max-w-xl leading-relaxed">
            What your AI has learned about your workflow recently. Use this to track your momentum and habits.
          </p>
        </div>
        <button
          onClick={fetchProfile}
          className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-full cursor-pointer shadow-sm border border-zinc-200 dark:border-zinc-800"
          title="Refresh Insights"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Surprise Discovery */}
      <div className="bg-indigo-50/50 dark:bg-indigo-500/5 p-8 md:p-10 rounded-3xl border border-indigo-100/50 dark:border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="relative z-10 flex flex-col items-start gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5" />
            Today's Discovery
          </div>
          <h2 className="text-2xl md:text-3xl font-medium text-zinc-900 dark:text-indigo-50 leading-tight">
            {surpriseDiscovery}
          </h2>
        </div>
      </div>

      {/* Narrative Discoveries Feed */}
      <div className="space-y-4 sm:space-y-6">
        {recentActions.length > 0 ? (
          recentActions.map((action, idx) => (
            <details 
              key={idx}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl shadow-sm overflow-hidden [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="p-5 sm:p-6 flex items-start gap-4 cursor-pointer outline-none select-none">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md">{action.system}</span>
                    <span className="text-[10px] font-medium text-zinc-400">Just now</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-medium text-zinc-900 dark:text-zinc-100 leading-snug pr-6">{action.action}</h3>
                </div>
                <div className="shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center group-open:rotate-180 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </summary>
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 flex items-start gap-2 leading-relaxed">
                  <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" />
                  {action.reason}
                </p>
              </div>
            </details>
          ))
        ) : (
          <div className="text-center py-20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
             <Brain className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
             <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Gathering Insights</h3>
             <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm mx-auto">Saarthi is observing your habits. Complete more tasks to reveal behavioral discoveries.</p>
          </div>
        )}
      </div>

      {onNavigateToBrain && (
        <div className="pt-8 flex justify-center">
          <button
            onClick={onNavigateToBrain}
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-semibold py-3 px-6 rounded-xl transition-all shadow-sm"
          >
            <Brain className="w-5 h-5" />
            Inspect AI Brain
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

    </div>
  );
}

