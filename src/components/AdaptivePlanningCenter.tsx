import React, { useEffect, useState } from "react";
import { Brain, Activity, Clock, Sliders, CalendarDays, TrendingUp, Zap, AlignLeft, BarChart2 } from "lucide-react";
import { AdaptivePlanningState, LearningProfile, Task, PlanningStrategy } from "../types";
import { adaptivePlanningService } from "../services/adaptivePlanningService";

interface AdaptivePlanningCenterProps {
  userId: string;
  tasks: Task[];
  learningProfile: LearningProfile | null;
  onPlanGenerated: (newTasks: Task[]) => void;
}

export default function AdaptivePlanningCenter({
  userId,
  tasks,
  learningProfile,
  onPlanGenerated
}: AdaptivePlanningCenterProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [planningState, setPlanningState] = useState<AdaptivePlanningState | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<PlanningStrategy>("balanced");
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const state = await adaptivePlanningService.getPlanningState(userId);
        setPlanningState(state);
        setSelectedStrategy(state.currentStrategy);
      } catch (e) {
        console.error("Failed to load planning state", e);
      }
      setLoading(false);
    };
    fetchState();
  }, [userId]);

  const handleRegenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const result = await adaptivePlanningService.regeneratePlan(
        userId,
        tasks,
        learningProfile,
        selectedStrategy,
        "User Request"
      );
      setInsights(result.insights);
      onPlanGenerated(result.updatedTasks);
      
      const updatedState = await adaptivePlanningService.getPlanningState(userId);
      setPlanningState(updatedState);
    } catch (e) {
      console.error(e);
      setInsights(["Failed to regenerate schedule."]);
    }
    setGenerating(false);
  };

  const strategies: { id: PlanningStrategy; label: string; desc: string; icon: any }[] = [
    { id: "balanced", label: "Balanced", desc: "Evenly distributes load to prevent burnout.", icon: Activity },
    { id: "deep_work", label: "Deep Work", desc: "Consolidates tasks into longer, focused blocks.", icon: Brain },
    { id: "deadline_first", label: "Deadline First", desc: "Prioritizes immediate due dates over energy.", icon: Clock },
    { id: "energy_optimized", label: "Energy Optimized", desc: "Matches task complexity with your energy peaks.", icon: Zap },
    { id: "recovery_optimized", label: "Recovery Optimized", desc: "Adds extra buffers and smaller blocks.", icon: AlignLeft },
    { id: "sprint_mode", label: "Sprint Mode", desc: "High density scheduling for rapid completion.", icon: TrendingUp },
  ];

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading Adaptive Engine...</div>;
  if (!planningState) return <div className="p-8 text-center text-rose-500">Failed to load planning state.</div>;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-indigo-500" />
            Adaptive Planning Engine
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Schedules optimized uniquely for your behavioral patterns.
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={generating}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Optimizing...
            </span>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Regenerate Plan
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8 space-y-8">
          {/* Strategy Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              Planning Strategy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {strategies.map((strat) => (
                <button
                  key={strat.id}
                  onClick={() => setSelectedStrategy(strat.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedStrategy === strat.id
                      ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <strat.icon className={`w-5 h-5 mb-2 ${selectedStrategy === strat.id ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400"}`} />
                  <span className="block font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-1">{strat.label}</span>
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{strat.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Adaptive Insights */}
          {insights.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                Optimization Insights
              </h3>
              <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-5 space-y-3">
                {insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Metrics */}
        <div className="md:col-span-4 space-y-6">
          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-zinc-400" />
              Engine Metrics
            </h3>
            
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-500 dark:text-zinc-400">Behavior Influence</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{planningState.behaviorInfluence}%</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
                  <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${planningState.behaviorInfluence}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-500 dark:text-zinc-400">Estimate Accuracy</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{planningState.estimateAccuracy}%</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${planningState.estimateAccuracy}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-500 dark:text-zinc-400">Planning Confidence</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{planningState.planningConfidence}%</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${planningState.planningConfidence}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Recovered</span>
                <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{planningState.recoveredHours}h</span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Optimizations</span>
                <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{planningState.adaptiveImprovements}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
