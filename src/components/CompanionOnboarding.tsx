import React, { useState } from "react";
import { CompanionType, CompanionProfile } from "../types";
import { ArrowRight, Sparkles, Brain, Rocket, Shield, Leaf, Zap } from "lucide-react";

interface CompanionOnboardingProps {
  onComplete: (profile: CompanionProfile) => void;
  userId: string;
}

export default function CompanionOnboarding({ onComplete, userId }: CompanionOnboardingProps) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleAnswer = (question: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [question]: answer }));
    if (step < 3) {
      setStep(step + 1);
    } else {
      finalizeProfile({ ...answers, [question]: answer });
    }
  };

  const finalizeProfile = (finalAnswers: Record<string, string>) => {
    // Basic heuristics to determine initial companion
    let points = {
      guardian: 0,
      commander: 0,
      strategist: 0,
      mentor: 0,
      challenger: 0
    };

    if (finalAnswers.q1 === "support") points.guardian += 2;
    if (finalAnswers.q1 === "push") points.commander += 2;
    if (finalAnswers.q1 === "explain") points.mentor += 2;
    if (finalAnswers.q1 === "logic") points.strategist += 2;

    if (finalAnswers.q2 === "high") points.commander += 1;
    if (finalAnswers.q2 === "high") points.challenger += 2;
    if (finalAnswers.q2 === "low") points.guardian += 2;
    if (finalAnswers.q2 === "medium") points.mentor += 1;

    if (finalAnswers.q3 === "direct") points.commander += 2;
    if (finalAnswers.q3 === "direct") points.strategist += 1;
    if (finalAnswers.q3 === "gentle") points.guardian += 2;
    if (finalAnswers.q3 === "gentle") points.mentor += 1;

    let bestMatch: CompanionType = "guardian";
    let max = -1;
    (Object.keys(points) as CompanionType[]).forEach(k => {
      if (points[k] > max) {
        max = points[k];
        bestMatch = k;
      }
    });

    const profiles: Record<CompanionType, CompanionProfile> = {
      guardian: {
        userId,
        activeCompanion: "guardian",
        coachingStyle: "supportive",
        motivationStyle: "gentle",
        communicationDensity: "medium",
        celebrationStyle: "enthusiastic",
        pressureTolerance: "low",
        companionEffectiveness: 80,
        recentAdaptations: []
      },
      commander: {
        userId,
        activeCompanion: "commander",
        coachingStyle: "direct",
        motivationStyle: "high_accountability",
        communicationDensity: "high",
        celebrationStyle: "aggressive",
        pressureTolerance: "high",
        companionEffectiveness: 80,
        recentAdaptations: []
      },
      strategist: {
        userId,
        activeCompanion: "strategist",
        coachingStyle: "analytical",
        motivationStyle: "logic",
        communicationDensity: "low",
        celebrationStyle: "analytical",
        pressureTolerance: "medium",
        companionEffectiveness: 80,
        recentAdaptations: []
      },
      mentor: {
        userId,
        activeCompanion: "mentor",
        coachingStyle: "educational",
        motivationStyle: "growth",
        communicationDensity: "medium",
        celebrationStyle: "enthusiastic",
        pressureTolerance: "medium",
        companionEffectiveness: 80,
        recentAdaptations: []
      },
      challenger: {
        userId,
        activeCompanion: "challenger",
        coachingStyle: "competitive",
        motivationStyle: "high_energy",
        communicationDensity: "high",
        celebrationStyle: "aggressive",
        pressureTolerance: "high",
        companionEffectiveness: 80,
        recentAdaptations: []
      }
    };

    onComplete(profiles[bestMatch]);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-md p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 mb-6 shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold font-display text-zinc-900 dark:text-zinc-50 mb-3 tracking-tight">
            Meet your Companion
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Saarthi adapts to how you work. Let's find the AI execution style that matches your psychology.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 overflow-hidden relative">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 h-1.5 bg-zinc-100 dark:bg-zinc-800 w-full">
            <div 
              className="h-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <div className="mt-4">
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">When deadlines get close, what helps you most?</h3>
                <div className="space-y-3">
                  <button onClick={() => handleAnswer('q1', 'push')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    "Push me hard. I need strict accountability."
                  </button>
                  <button onClick={() => handleAnswer('q1', 'support')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    "Support me. I need to reduce panic and take small steps."
                  </button>
                  <button onClick={() => handleAnswer('q1', 'logic')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    "Analyze it. Show me the trade-offs and logical path."
                  </button>
                  <button onClick={() => handleAnswer('q1', 'explain')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    "Coach me. Help me build better habits so it doesn't happen again."
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">How much pressure do you like to work under?</h3>
                <div className="space-y-3">
                  <button onClick={() => handleAnswer('q2', 'high')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    High pressure. It gives me momentum.
                  </button>
                  <button onClick={() => handleAnswer('q2', 'medium')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    Moderate pressure. Enough to care, not enough to panic.
                  </button>
                  <button onClick={() => handleAnswer('q2', 'low')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    Low pressure. I freeze when things get too intense.
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">How should Saarthi communicate with you?</h3>
                <div className="space-y-3">
                  <button onClick={() => handleAnswer('q3', 'direct')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    Direct, concise, and straight to the point. No fluff.
                  </button>
                  <button onClick={() => handleAnswer('q3', 'gentle')} className="w-full p-4 text-left rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all font-medium text-zinc-700 dark:text-zinc-300">
                    Warm, empathetic, and human-like.
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
