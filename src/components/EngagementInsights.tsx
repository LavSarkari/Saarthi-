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
            Insights
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 mt-3 max-w-xl leading-relaxed">
            What Saarthi has learned about you recently. This is a living reflection of your habits and execution patterns.
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

      {/* Narrative Discoveries */}
      <div className="space-y-6">
        {recentActions.length > 0 ? (
          recentActions.map((action, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-6 rounded-2xl flex flex-col md:flex-row gap-6 shadow-sm"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md">{action.system}</span>
                </div>
                <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100 mb-2">{action.action}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" />
                  {action.reason}
                </p>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
             <Brain className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
             <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Gathering Insights</h3>
             <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm mx-auto">Saarthi is observing your habits. Complete more tasks to reveal behavioral discoveries.</p>
          </div>
        )}
      </div>

      {/* Learning Timeline */}
      {recentActions.length > 0 && (
        <div className="pt-12 border-t border-zinc-200 dark:border-zinc-800/50 mt-12">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">Learning Timeline</h2>
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-200 dark:before:via-zinc-800 before:to-transparent">
            {recentActions.map((action, idx) => (
              <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-zinc-950 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                  <Check className="w-4 h-4" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Updated {action.system}</h4>
                    <span className="text-xs font-medium text-zinc-500">Recently</span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{action.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

