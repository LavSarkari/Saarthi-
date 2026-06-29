import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Calendar,
  CheckSquare,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
  Plus,
  Play,
  FileText,
  Copy,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Check,
  CalendarDays,
  Zap
} from "lucide-react";
import { Task, Subtask } from "../types";
import { getHoursRemaining, formatTimeRemaining } from "../lib/riskEngine";

interface TaskCardProps {
  key?: any;
  task: Task;
  onToggleSubtask: (task: Task, subtaskId: string) => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  onGenerateRescuePlan: (task: Task) => Promise<void> | void;
  onGetReminderContext: (task: Task) => Promise<void> | void;
  onSyncGoogleCalendar: (task: Task) => Promise<void> | void;
  onSnoozeDeadline: (task: Task, days: number) => Promise<void> | void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void> | void;
  isGeneratingContext: boolean;
  expandedSubtask: boolean;
  onToggleExpandSubtask: () => void;
  expandedReminder: boolean;
  onToggleExpandReminder: () => void;
  accessToken: string | null;
}

export default function TaskCard({
  task,
  onToggleSubtask,
  onDeleteTask,
  onGenerateRescuePlan,
  onGetReminderContext,
  onSyncGoogleCalendar,
  onSnoozeDeadline,
  onUpdateTask,
  isGeneratingContext,
  expandedSubtask,
  onToggleExpandSubtask,
  expandedReminder,
  onToggleExpandReminder,
  accessToken
}: TaskCardProps) {
  const [showSnoozeDropdown, setShowSnoozeDropdown] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editSubtasks, setEditSubtasks] = useState(task.subtasks);
  const [editLabels, setEditLabels] = useState<string[]>(task.labels || []);
  const [newLabelInput, setNewLabelInput] = useState("");

  const handleSaveEdit = () => {
    onUpdateTask(task.id, { 
      title: editTitle, 
      description: editDescription, 
      subtasks: editSubtasks,
      labels: editLabels
    });
    setIsEditing(false);
  };

  const hoursRemaining = getHoursRemaining(task.deadline);
  const totalSubtasks = task.subtasks.length;
  const completedSubtasks = task.subtasks.filter((s) => s.done).length;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Formatting due date
  const dueDate = new Date(task.deadline);
  const formattedDate = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const formattedTime = dueDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });

  // Theme mapping based on risk zone
  const zoneConfig = {
    critical: {
      border: "border-rose-100/80 dark:border-rose-950/40",
      accentLine: "bg-rose-500",
      bg: "bg-rose-50/5 dark:bg-rose-950/5",
      badgeBg: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100 dark:border-rose-900/30",
      badgeText: "Action needed",
      textColor: "text-rose-900 dark:text-rose-100",
      barBg: "bg-rose-500",
      icon: ShieldAlert
    },
    watch: {
      border: "border-amber-100/80 dark:border-amber-950/40",
      accentLine: "bg-amber-500",
      bg: "bg-amber-50/5 dark:bg-amber-950/5",
      badgeBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
      badgeText: "Review pacing",
      textColor: "text-amber-900 dark:text-amber-100",
      barBg: "bg-amber-500",
      icon: AlertTriangle
    },
    safe: {
      border: "border-emerald-100/80 dark:border-emerald-950/40",
      accentLine: "bg-emerald-500",
      bg: "bg-emerald-50/5 dark:bg-emerald-950/5",
      badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
      badgeText: "On track",
      textColor: "text-emerald-900 dark:text-emerald-100",
      barBg: "bg-emerald-500",
      icon: Check
    }
  };

  const currentZone = zoneConfig[task.riskZone as keyof typeof zoneConfig] || zoneConfig["safe"];
  const ZoneIcon = currentZone.icon;

  const handleCopyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border ${currentZone.border} rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col gap-4.5 relative overflow-hidden break-inside-avoid mb-4 w-full`}
    >
      {/* Decorative premium accent indicator */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${currentZone.accentLine}`} />

      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4 pl-1.5">
        <div className="space-y-1 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${currentZone.badgeBg}`}>
              <ZoneIcon className="w-3 h-3" />
              {currentZone.badgeText}
            </span>

            <span className="inline-flex items-center px-2 py-0.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400 text-[10px] font-medium rounded-md">
              {task.complexity === "high" ? "High focus needed" : task.complexity === "medium" ? "Moderate focus" : "Light focus"}
            </span>

            {task.googleCalendarSynced && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/40 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium rounded-md">
                <Calendar className="w-2.5 h-2.5" /> Calendar block active
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2 mt-2">
              <input 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-semibold bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-zinc-400 outline-none"
                placeholder="Task Title"
              />
              <textarea 
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 focus:ring-1 focus:ring-zinc-400 outline-none resize-none"
                rows={3}
                placeholder="Description"
              />
              <div className="space-y-2 max-h-[150px] overflow-y-auto mt-2">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Subtasks</span>
                {editSubtasks.map((sub, i) => (
                  <input
                    key={sub.id}
                    value={sub.title}
                    onChange={(e) => {
                      const newSubs = [...editSubtasks];
                      newSubs[i] = { ...newSubs[i], title: e.target.value };
                      setEditSubtasks(newSubs);
                    }}
                    className="w-full px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 focus:ring-1 focus:ring-zinc-400 outline-none"
                    placeholder="Milestone title"
                  />
                ))}
              </div>
              <div className="space-y-2 mt-2">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Labels</span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editLabels.map((lbl, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-medium rounded-md">
                      {lbl}
                      <button 
                        onClick={() => setEditLabels(editLabels.filter((_, i) => i !== idx))}
                        className="hover:text-indigo-900 dark:hover:text-indigo-200"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={newLabelInput}
                  onChange={(e) => setNewLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLabelInput.trim()) {
                      e.preventDefault();
                      if (!editLabels.includes(newLabelInput.trim())) {
                        setEditLabels([...editLabels, newLabelInput.trim()]);
                      }
                      setNewLabelInput('');
                    }
                  }}
                  className="w-full px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 focus:ring-1 focus:ring-zinc-400 outline-none"
                  placeholder="Add label and press Enter"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="px-3 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-base font-semibold font-sans tracking-tight text-zinc-900 dark:text-zinc-50 leading-snug">
                {task.title}
              </h3>
              
              {task.labels && task.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                  {task.labels.map((lbl, idx) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] uppercase tracking-wider font-semibold rounded-md">
                      {lbl}
                    </span>
                  ))}
                </div>
              )}
              
              <p className="text-zinc-500 dark:text-zinc-400 text-[12px] leading-relaxed max-w-2xl line-clamp-2">
                {task.description || "No description provided."}
              </p>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isEditing && (
            <button
              onClick={() => {
                setEditTitle(task.title);
                setEditDescription(task.description);
                setEditSubtasks(task.subtasks);
                setIsEditing(true);
              }}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Edit commitment"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
          )}
          <button
            onClick={() => onDeleteTask(task.id)}
            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
            title="Delete commitment"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress & Time Stats Grid */}
      <div className="flex flex-col gap-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/40 pl-1.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Completion Confidence Gauge */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
              {/* Radial progress bg */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  className="stroke-zinc-100 dark:stroke-zinc-800"
                  strokeWidth="3.5"
                  fill="transparent"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  className="stroke-zinc-800 dark:stroke-zinc-200"
                  strokeWidth="3.5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 15}
                  strokeDashoffset={2 * Math.PI * 15 * (1 - task.riskScore / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[10px] font-semibold text-zinc-900 dark:text-zinc-100">
                {progressPercent}%
              </span>
            </div>

            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Milestones met</p>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                {Math.round(100 - task.riskScore)}% confidence level
              </p>
            </div>
          </div>

          {/* Date Display */}
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 px-2.5 py-1.5 rounded-lg text-[11px] shrink-0">
            <CalendarDays className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{formattedDate}</span>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500">{formattedTime}</span>
            </div>
          </div>
        </div>

        {/* Task Completion Progress */}
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex justify-between text-[11px] items-center">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Task Progress ({completedSubtasks}/{totalSubtasks})</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-700 ease-out ${
                progressPercent === 100 ? "bg-emerald-500" :
                progressPercent >= 75 ? "bg-blue-500" :
                progressPercent >= 50 ? "bg-indigo-500" :
                progressPercent > 0 ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timeline Progress */}
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400 dark:text-zinc-500">Remaining cushion</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
              {formatTimeRemaining(hoursRemaining)} left
            </span>
          </div>
          <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${currentZone.barBg} transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(0, (hoursRemaining / 72) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Prominent Next Recommended Action step directly on card */}
      {task.reminderContext ? (
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/70 text-[11px] leading-relaxed space-y-1.5 pl-4.5 relative">
          <div className="absolute left-1.5 top-3.5 w-1 h-8 rounded bg-zinc-400 dark:bg-zinc-600" />
          <div className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
            <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Next recommended action</span>
          </div>
          <p className="text-zinc-800 dark:text-zinc-200 font-medium">
            {task.reminderContext.nextLogicalStep}
          </p>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-[11px] pl-3.5 bg-zinc-50/20 dark:bg-zinc-900/10">
          <span className="text-zinc-500 dark:text-zinc-400 font-medium">Ready to break down the next milestone?</span>
          <button
            onClick={() => onGetReminderContext(task)}
            disabled={isGeneratingContext}
            className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {isGeneratingContext ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <span>Build focus guide</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Accordions / Drawers */}
      <div className="flex flex-col gap-1.5 pl-1.5">
        {/* 1. Milestone subtasks toggler */}
        <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg overflow-hidden bg-white/70 dark:bg-zinc-900/40">
          <button
            onClick={onToggleExpandSubtask}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50/40 dark:bg-zinc-800/30 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-zinc-500" />
              <span>Milestones & Sprints</span>
            </div>
            {expandedSubtask ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <AnimatePresence initial={false}>
            {expandedSubtask && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800"
              >
                <div className="p-3 space-y-2">
                  {task.subtasks
                    .sort((a, b) => {
                      if (a.scheduledStart && b.scheduledStart) {
                        return new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
                      }
                      return (a.order || 0) - (b.order || 0);
                    })
                    .map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => onToggleSubtask(task, sub.id)}
                        className={`group flex items-start justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                          sub.done
                            ? "bg-emerald-50/10 dark:bg-emerald-950/10 border-emerald-100/30 dark:border-emerald-900/20 text-zinc-400 dark:text-zinc-500"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0 pt-0.5">
                          <button
                            type="button"
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                              sub.done
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-zinc-300 dark:border-zinc-700 group-hover:border-zinc-400 dark:group-hover:border-zinc-500 bg-white dark:bg-zinc-900"
                            }`}
                          >
                            {sub.done && <Check className="w-2.5 h-2.5 stroke-[3.5]" />}
                          </button>
                          <div className="flex flex-col min-w-0 gap-1.5 flex-1">
                            <span className={`text-[11px] font-medium leading-tight line-clamp-2 ${sub.done ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}`}>
                              {sub.title}
                            </span>
                            {sub.scheduledStart && !sub.done && (
                              <div className="flex items-center gap-1.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded w-max">
                                <Clock className="w-3 h-3 shrink-0" />
                                Scheduled: {new Date(sub.scheduledStart).toLocaleDateString()} at {new Date(sub.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                            {sub.adaptiveExplanation && !sub.done && (
                              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1 leading-tight">
                                <Zap className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                {sub.adaptiveExplanation}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                          <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200/40 dark:border-zinc-800/60">
                            {sub.estimatedMinutes}m
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. Action Steps & Templates (Reminder Context Detail) */}
        {task.reminderContext && (
          <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg overflow-hidden bg-white/70 dark:bg-zinc-900/40">
            <button
              onClick={onToggleExpandReminder}
              className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50/40 dark:bg-zinc-800/30 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>Focus guidelines & template</span>
              </div>
              {expandedReminder ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <AnimatePresence initial={false}>
              {expandedReminder && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800"
                >
                  <div className="p-4 space-y-3.5 text-xs">
                    {/* Contextual Advice */}
                    <div className="space-y-0.5">
                      <h4 className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">AI Focus Strategy</h4>
                      <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-[11px]">{task.reminderContext.contextualAdvice}</p>
                    </div>

                    {/* Resource Queries */}
                    {task.reminderContext.resourceSearchQueries && task.reminderContext.resourceSearchQueries.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">Recommended search queries</h4>
                        <div className="flex flex-wrap gap-1">
                          {task.reminderContext.resourceSearchQueries.map((q, idx) => (
                            <a
                              key={idx}
                              href={`https://www.google.com/search?q=${encodeURIComponent(q)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium rounded hover:bg-zinc-100 transition-colors"
                            >
                              <span>"{q}"</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Draft Template */}
                    {task.reminderContext.draftTemplate && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">Interactive starter template</h4>
                          <button
                            onClick={() => handleCopyTemplate(task.reminderContext!.draftTemplate)}
                            className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            {copiedTemplate ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            <span>{copiedTemplate ? "Copied!" : "Copy"}</span>
                          </button>
                        </div>
                        <pre className="bg-zinc-950 text-zinc-300 p-3 rounded-lg font-mono text-[10px] whitespace-pre-wrap overflow-x-auto border border-zinc-800/80 leading-relaxed shadow-inner max-h-[160px]">
                          {task.reminderContext.draftTemplate}
                        </pre>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Strategic Recovery Center Plan Block (In-card display) */}
      {task.recoveryPlan && (
        <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-xl p-3.5 space-y-2.5 ml-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-md">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              </span>
              <div>
                <h4 className="text-[11px] font-bold text-amber-900 dark:text-amber-300">Pacing recovery activated</h4>
              </div>
            </div>

            {task.recoveryPlan.isRecovered && (
              <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-900/30 text-emerald-750 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full uppercase">
                <Check className="w-2.5 h-2.5" /> Activated
              </span>
            )}
          </div>

          <div className="text-[11px] space-y-2 leading-relaxed text-amber-900 dark:text-amber-100">
            <p className="font-medium bg-amber-500/5 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/10 text-amber-950 dark:text-amber-200">
              💡 {task.recoveryPlan.messageToUser}
            </p>
            <div className="space-y-0.5">
              <span className="font-semibold text-[9px] text-zinc-400 uppercase tracking-wider block">Compromise strategy</span>
              <p className="text-zinc-600 dark:text-zinc-300 whitespace-pre-line pl-0.5">{task.recoveryPlan.advice}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer Operations Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/40 mt-1 pl-1.5">
        <div className="flex items-center gap-1.5">
          {/* Recovery Plan Formulate button */}
          {!task.recoveryPlan && (task.riskZone === "critical" || task.riskZone === "watch") && (
            <button
              onClick={() => onGenerateRescuePlan(task)}
              className="px-3 py-1.5 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 dark:text-amber-400 border border-amber-200/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3 h-3" />
              Rescue pacing
            </button>
          )}

          {/* Sync to Google Calendar */}
          <button
            onClick={() => onSyncGoogleCalendar(task)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5 ${
              task.googleCalendarSynced
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-500 dark:border-emerald-900/40"
                : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <Calendar className="w-3 h-3" />
            {task.googleCalendarSynced ? "Sync Event Blocks" : "Add to Google Calendar"}
          </button>
        </div>

        {/* Snooze / Adjust deadline */}
        <div className="relative">
          <button
            onClick={() => setShowSnoozeDropdown(!showSnoozeDropdown)}
            className="px-3 py-1.5 text-[11px] font-semibold bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>Snooze</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          <AnimatePresence>
            {showSnoozeDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSnoozeDropdown(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.1 }}
                  className="absolute bottom-full right-0 mb-1 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-20 overflow-hidden text-xs"
                >
                  <p className="px-3 py-1 text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Extend Deadline</p>
                  <button
                    onClick={() => {
                      onSnoozeDeadline(task, 1);
                      setShowSnoozeDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>+1 day buffer</span>
                    <span className="text-[9px] text-zinc-400 font-mono">+24h</span>
                  </button>
                  <button
                    onClick={() => {
                      onSnoozeDeadline(task, 3);
                      setShowSnoozeDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>+3 days buffer</span>
                    <span className="text-[9px] text-zinc-400 font-mono">+72h</span>
                  </button>
                  <button
                    onClick={() => {
                      onSnoozeDeadline(task, 7);
                      setShowSnoozeDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>+1 week buffer</span>
                    <span className="text-[9px] text-zinc-400 font-mono">+168h</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
