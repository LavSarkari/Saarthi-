import React, { useState } from "react";
import { CompanionType, CompanionProfile } from "../types";
import {
  Shield,
  Rocket,
  Brain,
  Leaf,
  Zap,
  ChevronRight,
  Check,
} from "lucide-react";

interface CompanionCenterProps {
  profile: CompanionProfile | null;
  onUpdateProfile: (updates: Partial<CompanionProfile>) => Promise<void>;
  onClose?: () => void;
  inline?: boolean;
}

const COMPANIONS: Record<
  CompanionType,
  {
    name: string;
    description: string;
    icon: React.ReactNode;
    traits: string[];
    selectedBorderClass: string;
    selectedIconClass: string;
    checkColorClass: string;
  }
> = {
  guardian: {
    name: "The Guardian",
    description:
      "Calm, protective, and supportive. Helps you recover without judgement.",
    icon: <Shield className="w-6 h-6" />,
    traits: ["Warm", "Slow-paced", "Reassuring"],
    selectedBorderClass:
      "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-md",
    selectedIconClass:
      "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400",
    checkColorClass: "text-emerald-500",
  },
  commander: {
    name: "The Commander",
    description: "Direct, disciplined, and high accountability. High urgency.",
    icon: <Rocket className="w-6 h-6" />,
    traits: ["Confident", "Focused", "Urgent"],
    selectedBorderClass:
      "border-rose-500 bg-rose-50 dark:bg-rose-950/20 shadow-md",
    selectedIconClass:
      "bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400",
    checkColorClass: "text-rose-500",
  },
  strategist: {
    name: "The Strategist",
    description:
      "Logical, analytical, and decision-oriented. Focuses on efficiency.",
    icon: <Brain className="w-6 h-6" />,
    traits: ["Calm", "Analytical", "Precise"],
    selectedBorderClass:
      "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-md",
    selectedIconClass:
      "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
    checkColorClass: "text-blue-500",
  },
  mentor: {
    name: "The Mentor",
    description:
      "Patient, educational, and encouraging. Builds long-term habits.",
    icon: <Leaf className="w-6 h-6" />,
    traits: ["Patient", "Teaching", "Supportive"],
    selectedBorderClass:
      "border-teal-500 bg-teal-50 dark:bg-teal-950/20 shadow-md",
    selectedIconClass:
      "bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400",
    checkColorClass: "text-teal-500",
  },
  challenger: {
    name: "The Challenger",
    description: "Competitive, energetic, and momentum focused.",
    icon: <Zap className="w-6 h-6" />,
    traits: ["Energetic", "Pushy", "Enthusiastic"],
    selectedBorderClass:
      "border-amber-500 bg-amber-50 dark:bg-amber-950/20 shadow-md",
    selectedIconClass:
      "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
    checkColorClass: "text-amber-500",
  },
};

export default function CompanionCenter({
  profile,
  onUpdateProfile,
  onClose,
  inline,
}: CompanionCenterProps) {
  const [selectedCompanion, setSelectedCompanion] =
    useState<CompanionType | null>(profile?.activeCompanion || null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedCompanion) return;
    setIsSaving(true);
    await onUpdateProfile({ activeCompanion: selectedCompanion });
    setIsSaving(false);
    if (onClose) onClose();
  };

  const content = (
    <>
      {!inline && (
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-display">
              Companion Profile
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Select how Saarthi should interact with you.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {inline && (
        <div className="mb-6">
          <h3 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100 mb-2">
            Challenger Profile
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Select how Saarthi should interact with you.
          </p>
        </div>
      )}

      <div className={inline ? "" : "p-6 overflow-y-auto"}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            Object.entries(COMPANIONS) as [
              CompanionType,
              (typeof COMPANIONS)[CompanionType],
            ][]
          ).map(([key, data]) => {
            const isSelected = selectedCompanion === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedCompanion(key)}
                className={`flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all ${
                  isSelected
                    ? data.selectedBorderClass
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-transparent"
                }`}
              >
                <div
                  className={`p-2 rounded-xl mb-3 ${
                    isSelected
                      ? data.selectedIconClass
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {data.icon}
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50 flex items-center justify-between w-full">
                  {data.name}
                  {isSelected && (
                    <Check className={`w-4 h-4 ${data.checkColorClass}`} />
                  )}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-3 leading-relaxed">
                  {data.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {data.traits.map((trait) => (
                    <span
                      key={trait}
                      className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-400 font-medium"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {profile && (
          <div className="mt-8 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Behavior Profile
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Coaching:
                </span>
                <span className="ml-2 font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                  {profile.coachingStyle}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Density:
                </span>
                <span className="ml-2 font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                  {profile.communicationDensity}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Adaptation:
                </span>
                <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">
                  Learning Active
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Effectiveness:
                </span>
                <span className="ml-2 font-medium text-zinc-700 dark:text-zinc-300">
                  {profile.companionEffectiveness}%
                </span>
              </div>
            </div>

            {profile.recentAdaptations &&
              profile.recentAdaptations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Recent Adaptations
                  </h4>
                  <ul className="space-y-1.5">
                    {profile.recentAdaptations.map((adapt, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-start gap-2"
                      >
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{adapt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </div>

      <div
        className={`p-4 ${inline ? "mt-6" : "border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"} flex justify-end gap-3`}
      >
        {onClose && !inline && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={
            !selectedCompanion ||
            isSaving ||
            selectedCompanion === profile?.activeCompanion
          }
          className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isSaving ? "Saving..." : "Set Companion"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-zinc-50 dark:bg-[#0a0a0a] animate-in fade-in duration-200 overflow-y-auto pb-24 md:pb-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col my-auto relative">
        {content}
      </div>
    </div>
  );
}
