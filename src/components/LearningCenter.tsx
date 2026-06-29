import React, { useEffect, useState } from "react";
import {
  BrainCircuit,
  Settings,
  MoreVertical,
  Activity,
  Edit2,
  Trash2,
  RotateCcw,
  Download,
  Calendar,
  MessageSquare,
  BarChart3,
  Clock
} from "lucide-react";
import { LearningProfile, LearnedAttribute } from "../types";
import { behavioralIntelligenceService } from "../services/behavioralIntelligenceService";

interface Props {
  userId: string;
}

export default function LearningCenter({ userId }: Props) {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const p = await behavioralIntelligenceService.getLearningProfile(userId);
        setProfile(p);
      } catch (err) {
        console.error("Failed to load learning profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <BrainCircuit className="w-8 h-8 text-indigo-500 animate-bounce" />
          <p className="text-sm font-medium text-zinc-500">Accessing Intelligence Core...</p>
        </div>
      </div>
    );
  }

  const sections = [
    {
      id: "behavior",
      title: "Behavior",
      icon: <Activity className="w-5 h-5 text-emerald-500" />,
      items: [
        { label: "Preferred Work Hours", attr: profile?.preferredWorkHours },
        { label: "Productive Weekdays", attr: profile?.mostProductiveWeekday },
        { label: "Focus Duration", attr: profile?.averageFocusDurationMinutes, format: (val: any) => `${val} mins` },
        { label: "Break Habits", attr: profile?.averageBreakDurationMinutes, format: (val: any) => `${val} mins` },
      ]
    },
    {
      id: "planning",
      title: "Planning",
      icon: <Calendar className="w-5 h-5 text-blue-500" />,
      items: [
        { label: "Estimation Accuracy", attr: profile?.averageEstimationErrorPercent, format: (val: any) => `${val}% error margin` },
        { label: "Average Workload", attr: profile?.averageDailyWorkloadMinutes, format: (val: any) => `${val} mins/day` },
        { label: "Workload Density", attr: profile?.preferredWorkloadDensity },
        { label: "Recovery Mode", attr: profile?.preferredRecoveryMode },
      ]
    },
    {
      id: "communication",
      title: "Communication",
      icon: <MessageSquare className="w-5 h-5 text-amber-500" />,
      items: [
        { label: "Preferred AI Personality", attr: profile?.preferredCoachingStyle },
        { label: "Telegram Response Rate", attr: profile?.responseRateTelegram, format: (val: any) => `${val}%` },
        { label: "Communication Style", attr: profile?.preferredCommunicationStyle },
      ]
    },
    {
      id: "task-intelligence",
      title: "Task Intelligence",
      icon: <BarChart3 className="w-5 h-5 text-purple-500" />,
      items: [
        { label: "Frequently Delayed", attr: profile?.mostDelayedSubject },
        { label: "Completed Fastest", attr: profile?.mostSuccessfulCategory },
        { label: "Successful Task Size", attr: profile?.mostSuccessfulTaskSize },
        { label: "Avg. Procrastination", attr: profile?.averageProcrastinationDelayDays, format: (val: any) => `${val} days` },
      ]
    }
  ];

  return (
    <div className="flex flex-col gap-12 max-w-4xl mx-auto w-full animate-fade-in pb-24 pt-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
           <BrainCircuit className="w-8 h-8 text-zinc-900 dark:text-zinc-100" />
           <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-display">
             Learning Profile
           </h1>
        </div>
        <p className="text-zinc-500 dark:text-zinc-400 text-base max-w-2xl leading-relaxed">
          The AI Brain. This is exactly what Saarthi currently knows about your execution patterns. You have complete transparency and control over this behavioral model.
        </p>
      </div>

      <div className="flex flex-col gap-16">
        {sections.map((section) => (
          <div key={section.id} className="space-y-6">
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              {section.icon}
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{section.title}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.items.map((item, idx) => (
                <AttributeCard key={idx} label={item.label} attribute={item.attr} formatValue={item.format} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AttributeCardProps {
  label: string;
  attribute?: LearnedAttribute;
  formatValue?: (v: any) => string;
}

const AttributeCard: React.FC<AttributeCardProps> = ({ label, attribute, formatValue }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm relative group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</h3>
        
        <div className="relative">
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-20 py-1">
              <button onClick={() => setMenuOpen(false)} className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={() => setMenuOpen(false)} className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5" /> Recalculate</button>
              <button onClick={() => setMenuOpen(false)} className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Export</button>
              <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
              <button onClick={() => setMenuOpen(false)} className="w-full text-left px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Forget</button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <span className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {attribute?.value !== undefined ? (formatValue ? formatValue(attribute.value) : attribute.value) : "Learning..."}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 border-y border-zinc-100 dark:border-zinc-800 py-3">
        <div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">Confidence</div>
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{attribute?.confidence !== undefined ? `${attribute.confidence}%` : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">Evidence</div>
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{attribute?.evidenceCount !== undefined ? attribute.evidenceCount : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">Updated</div>
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap overflow-hidden text-ellipsis" title={attribute?.lastUpdated ? new Date(attribute.lastUpdated).toLocaleDateString() : ""}>
            {attribute?.lastUpdated ? new Date(attribute.lastUpdated).toLocaleDateString() : "—"}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Explanation</div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {attribute?.source || "Insufficient data to form a conclusion."}
        </p>
      </div>
      
      {/* Click outside overlay for menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
      )}
    </div>
  );
}

