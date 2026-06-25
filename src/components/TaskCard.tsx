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
  CalendarDays
} from "lucide-react";
import { Task, Subtask } from "../types";
import { getHoursRemaining } from "../lib/riskEngine";

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

  const handleSaveEdit = () => {
    onUpdateTask(task.id, { title: editTitle, description: editDescription });
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
      border: "border-rose-200/90 dark:border-rose-950/70",
      bg: "bg-rose-50/15 dark:bg-rose-950/10",
      badgeBg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 dark:border-rose-800/40",
      badgeText: "Critical",
      textColor: "text-rose-900 dark:text-rose-100",
      accentGlow: "rgba(239, 68, 68, 0.05)",
      barBg: "bg-rose-500",
      icon: ShieldAlert
    },
    watch: {
      border: "border-amber-200/90 dark:border-amber-950/70",
      bg: "bg-amber-50/15 dark:bg-amber-950/10",
      badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-800/40",
      badgeText: "Caution",
      textColor: "text-amber-900 dark:text-amber-100",
      accentGlow: "rgba(245, 158, 11, 0.03)",
      barBg: "bg-amber-500",
      icon: AlertTriangle
    },
    safe: {
      border: "border-emerald-200/90 dark:border-emerald-950/70",
      bg: "bg-emerald-50/15 dark:bg-emerald-950/5",
      badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-800/40",
      badgeText: "Secure",
      textColor: "text-emerald-900 dark:text-emerald-100",
      accentGlow: "rgba(16, 185, 129, 0.02)",
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
      className={`bg-white dark:bg-zinc-900 border ${currentZone.border} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-5 relative overflow-hidden break-inside-avoid mb-4 w-full`}
      style={{
        background: `linear-gradient(to bottom, var(--card-bg) 0%, ${currentZone.bg} 100%)`
      }}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${currentZone.badgeBg}`}>
              <ZoneIcon className="w-3.5 h-3.5" />
              {currentZone.badgeText} ({task.riskScore}/100)
            </span>

            <span className="inline-flex items-center px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] font-mono rounded-md">
              {task.complexity.toUpperCase()} EFFORT
            </span>

            {task.googleCalendarSynced && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono rounded-md">
                <Calendar className="w-3 h-3" /> G-CAL
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2 mt-2">
              <input 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-bold bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Task Title"
              />
              <textarea 
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                rows={3}
                placeholder="Description"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-xs font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold font-display tracking-tight text-zinc-950 dark:text-zinc-50 leading-snug">
                {task.title}
              </h3>
              
              <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed max-w-2xl line-clamp-2">
                {task.description || "No description provided."}
              </p>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              title="Edit commitment"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
          )}
          <button
            onClick={() => onDeleteTask(task.id)}
            className="btn-danger self-start"
            title="Delete commitment"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress & Time Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 items-center">
        {/* Completion Confidence Gauge */}
        <div className="md:col-span-4 flex items-center gap-3">
          <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
            {/* Radial progress bg */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                className="stroke-zinc-100 dark:stroke-zinc-800"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                className="stroke-zinc-800 dark:stroke-zinc-200"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - task.riskScore / 100)}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[11px] font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {progressPercent}%
            </span>
          </div>

          <div className="space-y-0.5">
            <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Completion Confidence</p>
            <p className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-100">
              {Math.round(100 - task.riskScore)}% Confidence
            </p>
          </div>
        </div>

        {/* Timeline Progress */}
        <div className="md:col-span-5 flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider">Timeline Buffer</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-bold font-mono">
              {hoursRemaining.toFixed(1)}h left
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${currentZone.barBg} transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(0, (hoursRemaining / 72) * 100))}%` }}
            />
          </div>
        </div>

        {/* Date Display */}
        <div className="md:col-span-3 flex items-center gap-2.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 p-2.5 rounded-xl text-xs">
          <CalendarDays className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-zinc-800 dark:text-zinc-200">{formattedDate}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{formattedTime}</span>
          </div>
        </div>
      </div>

      {/* Accordions / Drawers */}
      <div className="flex flex-col gap-2">
        {/* 1. Milestone subtasks toggler */}
        <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden bg-white/70 dark:bg-zinc-900/40">
          <button
            onClick={onToggleExpandSubtask}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-zinc-500" />
              <span>Milestones & Sprints ({completedSubtasks}/{totalSubtasks})</span>
            </div>
            {expandedSubtask ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence initial={false}>
            {expandedSubtask && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800"
              >
                <div className="p-4 space-y-2.5">
                  {task.subtasks
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => onToggleSubtask(task, sub.id)}
                        className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          sub.done
                            ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-zinc-400 dark:text-zinc-500"
                            : "bg-white dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                              sub.done
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-zinc-300 dark:border-zinc-700 group-hover:border-zinc-400 dark:group-hover:border-zinc-600 bg-white dark:bg-zinc-900"
                            }`}
                          >
                            {sub.done && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <span className={`text-xs font-medium leading-tight ${sub.done ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}`}>
                            {sub.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200/40 dark:border-zinc-800/60">
                          {sub.estimatedMinutes}m
                        </span>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. Action Steps & Templates (Reminder Context) */}
        <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden bg-white/70 dark:bg-zinc-900/40">
          <button
            onClick={() => {
              if (!task.reminderContext) {
                onGetReminderContext(task);
              } else {
                onToggleExpandReminder();
              }
            }}
            disabled={isGeneratingContext}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-75"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>AI Next Step & Copilot Guidelines</span>
            </div>
            {isGeneratingContext ? (
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
            ) : task.reminderContext ? (
              expandedReminder ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            ) : (
              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 px-2 py-0.5 rounded-md">BUILD DOCK</span>
            )}
          </button>

          <AnimatePresence initial={false}>
            {expandedReminder && task.reminderContext && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800"
              >
                <div className="p-5 space-y-4 text-xs bg-indigo-50/5 dark:bg-indigo-950/5">
                  {/* Next Step */}
                  <div className="space-y-1 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/40 p-3.5 rounded-xl">
                    <h4 className="font-bold text-indigo-950 dark:text-indigo-200 font-display flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                      Immediate Tactical Next Step
                    </h4>
                    <p className="text-indigo-900 dark:text-indigo-350 leading-relaxed font-medium">
                      {task.reminderContext.nextLogicalStep}
                    </p>
                  </div>

                  {/* Contextual Advice */}
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-800 dark:text-zinc-300 font-mono text-[10px] uppercase tracking-wider">AI Executive Advice</h4>
                    <p className="text-zinc-600 dark:text-zinc-350 leading-relaxed">{task.reminderContext.contextualAdvice}</p>
                  </div>

                  {/* Resource Queries */}
                  {task.reminderContext.resourceSearchQueries && task.reminderContext.resourceSearchQueries.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-zinc-800 dark:text-zinc-300 font-mono text-[10px] uppercase tracking-wider">Recommended Study Queries</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {task.reminderContext.resourceSearchQueries.map((q, idx) => (
                          <a
                            key={idx}
                            href={`https://www.google.com/search?q=${encodeURIComponent(q)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary px-2 py-1 text-[11px] font-medium"
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
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-zinc-800 dark:text-zinc-300 font-mono text-[10px] uppercase tracking-wider">Interactive Starter Template</h4>
                        <button
                          onClick={() => handleCopyTemplate(task.reminderContext!.draftTemplate)}
                          className="flex items-center gap-1 text-[10px] text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                        >
                          {copiedTemplate ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedTemplate ? "Copied!" : "Copy Template"}</span>
                        </button>
                      </div>
                      <pre className="bg-zinc-950 text-zinc-300 p-3.5 rounded-xl font-mono text-[11px] whitespace-pre-wrap overflow-x-auto border border-zinc-800/80 leading-relaxed shadow-inner">
                        {task.reminderContext.draftTemplate}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Strategic Recovery Center Plan Block (In-card display) */}
      {task.recoveryPlan && (
        <div className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 dark:border-amber-900/40 rounded-2xl p-4.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-500/15 dark:bg-amber-500/10 border border-amber-500/30 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md">
                <AlertTriangle className="w-4 h-4 shrink-0" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-amber-950 dark:text-amber-300 font-display">Armed Recovery Roadmap</h4>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono uppercase tracking-wide">
                  {task.recoveryPlan.isRecovered ? "STATUS: ACTIVE ROADMAP" : "STATUS: CRITICAL CONSTRAINED"}
                </p>
              </div>
            </div>

            {task.recoveryPlan.isRecovered && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase">
                <Check className="w-3 h-3" /> Activated
              </span>
            )}
          </div>

          <div className="text-xs space-y-2 leading-relaxed text-amber-950 dark:text-amber-100">
            <p className="font-medium bg-amber-500/10 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/10 dark:border-amber-900/30 text-amber-950 dark:text-amber-200">
              💡 {task.recoveryPlan.messageToUser}
            </p>
            <div className="space-y-1">
              <span className="font-bold text-[10px] font-mono text-amber-800 dark:text-amber-400 uppercase tracking-wider">Tactical Compromise Guidelines</span>
              <p className="text-zinc-600 dark:text-zinc-300 whitespace-pre-line text-xs pl-0.5">{task.recoveryPlan.advice}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer Operations Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 mt-1">
        <div className="flex items-center gap-2">
          {/* Recovery Plan Formulate button */}
          {!task.recoveryPlan && (task.riskZone === "critical" || task.riskZone === "watch") && (
            <button
              onClick={() => onGenerateRescuePlan(task)}
              className="btn-accent py-2 px-3.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Formulate Rescue Plan
            </button>
          )}

          {/* Sync to Google Calendar */}
          <button
            onClick={() => onSyncGoogleCalendar(task)}
            className={`btn-secondary py-2 px-3.5 ${
              task.googleCalendarSynced
                ? "bg-emerald-50 border-emerald-150 text-emerald-800 hover:bg-emerald-100"
                : ""
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {task.googleCalendarSynced ? "Sync Event Blocks" : "Sync to Google Calendar"}
          </button>
        </div>

        {/* Snooze / Adjust deadline */}
        <div className="relative">
          <button
            onClick={() => setShowSnoozeDropdown(!showSnoozeDropdown)}
            className="btn-secondary py-2 px-3.5"
          >
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Snooze Deadline</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          <AnimatePresence>
            {showSnoozeDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSnoozeDropdown(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1.5 z-20 overflow-hidden text-xs"
                >
                  <p className="px-3.5 py-1 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Extend Deadline</p>
                  <button
                    onClick={() => {
                      onSnoozeDeadline(task, 1);
                      setShowSnoozeDropdown(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>+1 Day Buffer</span>
                    <span className="text-[10px] text-zinc-400 font-mono">+24h</span>
                  </button>
                  <button
                    onClick={() => {
                      onSnoozeDeadline(task, 3);
                      setShowSnoozeDropdown(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>+3 Days Buffer</span>
                    <span className="text-[10px] text-zinc-400 font-mono">+72h</span>
                  </button>
                  <button
                    onClick={() => {
                      onSnoozeDeadline(task, 7);
                      setShowSnoozeDropdown(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>+1 Week Buffer</span>
                    <span className="text-[10px] text-zinc-400 font-mono">+168h</span>
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
