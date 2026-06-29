import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  HeartHandshake,
  Shield,
  Sparkles,
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  ArrowRightCircle,
  Moon,
  Zap
} from "lucide-react";
import { AIRecoveryPlan, RecoveryMode } from "../types";
import { behavioralIntelligenceService } from "../services/behavioralIntelligenceService";

interface RecoveryCenterProps {
  userId: string;
  onClose?: () => void;
  onRecovered: () => void;
  inline?: boolean;
}

export default function RecoveryCenter({
  userId,
  onClose,
  onRecovered,
  inline,
}: RecoveryCenterProps) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AIRecoveryPlan | null>(null);
  const [mode, setMode] = useState<RecoveryMode>("balanced");
  const [executing, setExecuting] = useState(false);
  const [executionSuccess, setExecutionSuccess] = useState(false);

  const generatePlan = async (selectedMode: RecoveryMode) => {
    setLoading(true);
    setMode(selectedMode);
    setPlan(null);
    try {
      const res = await fetch("/api/gemini/recovery-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode: selectedMode }),
      });
      if (!res.ok) throw new Error("Failed to generate plan");
      const data = await res.json();
      setPlan(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const executePlan = async () => {
    if (!plan) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/gemini/execute-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId: plan.id }),
      });
      if (res.ok) {
        // Track the accepted recovery
        await behavioralIntelligenceService.trackEvent({
          userId,
          eventType: "RECOVERY_ACCEPTED",
          confidence: 100,
          metadata: { mode: plan.mode }
        });
        
        setExecutionSuccess(true);
        setTimeout(() => {
          onRecovered();
          if (onClose) onClose();
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      setExecuting(false);
    }
  };

  const content = (
    <>
      {!inline && (
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                <HeartHandshake className="h-8 w-8 text-indigo-500" />
                Recovery OS
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-2 text-lg">
                Life happens. Let's rebuild your week together, safely.
              </p>
            </div>
            {onClose && (
              <button
                onClick={async () => {
                  if (plan) {
                    await behavioralIntelligenceService.trackEvent({
                      userId,
                      eventType: "RECOVERY_REJECTED",
                      confidence: 100
                    });
                  }
                  onClose();
                }}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {inline && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-indigo-500" />
            Recovery OS
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Life happens. Let's rebuild your week together, safely.
          </p>
        </div>
      )}

      <div className={inline ? "" : "p-8"}>
        {!plan && !loading && (
          <div className="space-y-8">
            <div className="text-center max-w-4xl mx-auto py-12">
              <div className="mx-auto w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center mb-6">
                <HeartHandshake className="h-10 w-10 text-rose-500" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
                Saarthi detected your week has become unrealistic.
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
                Choose a recovery path to let Saarthi restructure your remaining commitments automatically.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-left">
                {/* Balanced */}
                <button
                  onClick={() => generatePlan("balanced")}
                  className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all text-left bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-500 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                      <Activity className="h-5 w-5 text-indigo-500" /> Balanced (Default)
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-zinc-400" /> Completion: <span className="font-bold text-zinc-900 dark:text-white">85%</span></div>
                    <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-zinc-400" /> Stress: <span className="font-bold text-amber-500">Medium</span></div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-400" /> Overtime: <span className="font-bold text-zinc-900 dark:text-white">2.5 hrs</span></div>
                    <div className="flex items-center gap-2"><Moon className="w-4 h-4 text-zinc-400" /> Sleep: <span className="font-bold text-zinc-900 dark:text-white">7.5 hrs/night</span></div>
                  </div>
                </button>

                {/* Minimal */}
                <button
                  onClick={() => generatePlan("minimal")}
                  className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all text-left bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md hover:border-rose-500 dark:hover:border-rose-500 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                      <Shield className="h-5 w-5 text-rose-500" /> Minimal Survival
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-zinc-400" /> Completion: <span className="font-bold text-zinc-900 dark:text-white">40%</span></div>
                    <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-zinc-400" /> Stress: <span className="font-bold text-emerald-500">Low</span></div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-400" /> Overtime: <span className="font-bold text-zinc-900 dark:text-white">0 hrs</span></div>
                    <div className="flex items-center gap-2"><Moon className="w-4 h-4 text-zinc-400" /> Sleep: <span className="font-bold text-zinc-900 dark:text-white">8 hrs/night</span></div>
                  </div>
                </button>

                {/* Wellness */}
                <button
                  onClick={() => generatePlan("wellness")}
                  className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all text-left bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-500 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                      <HeartHandshake className="h-5 w-5 text-emerald-500" /> Wellness Focus
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-zinc-400" /> Completion: <span className="font-bold text-zinc-900 dark:text-white">60%</span></div>
                    <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-zinc-400" /> Stress: <span className="font-bold text-emerald-500">Very Low</span></div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-400" /> Overtime: <span className="font-bold text-zinc-900 dark:text-white">0 hrs</span></div>
                    <div className="flex items-center gap-2"><Moon className="w-4 h-4 text-zinc-400" /> Sleep: <span className="font-bold text-zinc-900 dark:text-white">9 hrs/night</span></div>
                  </div>
                </button>

                {/* Maximum */}
                <button
                  onClick={() => generatePlan("maximum")}
                  className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all text-left bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md hover:border-amber-500 dark:hover:border-amber-500 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" /> Maximum Performance
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-zinc-400" /> Completion: <span className="font-bold text-zinc-900 dark:text-white">95%</span></div>
                    <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-zinc-400" /> Stress: <span className="font-bold text-rose-500">Very High</span></div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-400" /> Overtime: <span className="font-bold text-zinc-900 dark:text-white">8 hrs</span></div>
                    <div className="flex items-center gap-2"><Moon className="w-4 h-4 text-zinc-400" /> Sleep: <span className="font-bold text-zinc-900 dark:text-white">6 hrs/night</span></div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="py-24 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-900 rounded-full animate-pulse"></div>
              <div className="w-16 h-16 border-4 border-indigo-500 rounded-full animate-spin absolute top-0 left-0 border-t-transparent"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Analyzing Your Reality
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                Reviewing remaining effort, deadlines, and calendar density...
              </p>
            </div>
          </div>
        )}

        {plan && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            {/* Compassionate Summary */}
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-xl md:text-2xl font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
                {plan.situationSummary.message}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Expected Recovery Metrics */}
              <div className="md:col-span-1 bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-6">
                <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Expected Recovery
                </h4>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-zinc-500">
                    <span>Completion Confidence</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {plan.expectedRecovery.confidenceBefore}% →{" "}
                      {plan.expectedRecovery.confidenceAfter}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-zinc-400 transition-all"
                      style={{
                        width: `${plan.expectedRecovery.confidenceBefore}%`,
                      }}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{
                        width: `${plan.expectedRecovery.confidenceAfter - plan.expectedRecovery.confidenceBefore}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    Time Recovered
                  </p>
                  <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                    {plan.expectedRecovery.timeRecoveredHours}h
                  </p>
                </div>

                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    Stress Reduction
                  </p>
                  <p className="text-lg font-bold capitalize text-zinc-900 dark:text-white">
                    {plan.expectedRecovery.stressReductionEstimate}
                  </p>
                </div>
              </div>

              {/* Tradeoffs & Adjustments */}
              <div className="md:col-span-2 space-y-6">
                <h4 className="font-bold text-zinc-900 dark:text-white text-lg border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  Suggested Trade-offs
                </h4>
                <div className="space-y-3">
                  {plan.suggestedTradeoffs.map((tradeoff, i) => (
                    <div
                      key={i}
                      className="flex gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                    >
                      <div className="mt-0.5">
                        {tradeoff.proposedAction === "reduce_scope" && (
                          <ArrowRightCircle className="h-5 w-5 text-blue-500" />
                        )}
                        {tradeoff.proposedAction === "delay" && (
                          <CalendarClock className="h-5 w-5 text-amber-500" />
                        )}
                        {tradeoff.proposedAction === "split" && (
                          <Activity className="h-5 w-5 text-indigo-500" />
                        )}
                        {tradeoff.proposedAction === "skip" && (
                          <TrendingDown className="h-5 w-5 text-rose-500" />
                        )}
                        {tradeoff.proposedAction === "compress" && (
                          <Clock className="h-5 w-5 text-purple-500" />
                        )}
                      </div>
                      <div>
                        <h5 className="font-semibold text-zinc-900 dark:text-white text-sm">
                          {tradeoff.originalTitle}
                        </h5>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                          {tradeoff.explanation}
                        </p>
                        <span className="inline-block mt-2 px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded text-xs font-semibold">
                          Rescued{" "}
                          {Math.round((tradeoff.effortSavedMinutes / 60) * 10) /
                            10}
                          h
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-8">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-lg border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">
                    Critical Path (Protected)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {plan.newWeeklyPlan
                      .filter(
                        (p) =>
                          p.action === "keep" ||
                          plan.criticalCommitments.includes(p.taskId),
                      )
                      .map((t) => (
                        <span
                          key={t.taskId}
                          className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-lg text-sm font-medium flex items-center gap-2 border border-zinc-200 dark:border-zinc-700"
                        >
                          <Shield className="h-3.5 w-3.5 text-indigo-500" />
                          {t.title}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4">
              <button
                onClick={() => setPlan(null)}
                className="px-6 py-3 rounded-xl font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Adjust Strategy
              </button>
              <button
                onClick={executePlan}
                disabled={executing || executionSuccess}
                className="px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {executing
                  ? "Synchronizing Reality..."
                  : executionSuccess
                    ? "Week Rebuilt!"
                    : "Accept & Rebuild Plan"}
                {!executing && !executionSuccess && (
                  <ArrowRight className="h-5 w-5" />
                )}
                {executionSuccess && <CheckCircle2 className="h-5 w-5" />}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="h-full w-full bg-zinc-50 dark:bg-[#0a0a0a] overflow-y-auto pb-24 md:pb-4 animate-in fade-in duration-200">
      <div className="min-h-full py-6 md:py-12 px-4 sm:px-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-4xl bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          {content}
        </motion.div>
      </div>
    </div>
  );
}
