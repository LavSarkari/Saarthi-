import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import {
  Flame,
  CheckCircle2,
  Circle,
  Clock,
  Play,
  SkipForward,
  ArrowRight,
  Plus,
  Droplets,
  BookOpen,
  Dumbbell,
  Code,
  Trash2,
  GripVertical,
} from "lucide-react";
import { RecurringCommitment, RecurringInstance } from "../types";
import { recurringCommitmentService } from "../services/recurringCommitmentService";

interface RecurringCommitmentsPanelProps {
  user: any;
  onSuggestAction?: (action: string) => void;
}

export default function RecurringCommitmentsPanel({
  user,
  onSuggestAction,
}: RecurringCommitmentsPanelProps) {
  const [instances, setInstances] = useState<RecurringInstance[]>([]);
  const [commitments, setCommitments] = useState<RecurringCommitment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const localISOTime = new Date(today.getTime() - offset)
        .toISOString()
        .slice(0, -1);
      const dateStr = localISOTime.split("T")[0];

      // Ensure instances are generated
      const loadedInstances =
        await recurringCommitmentService.generateDailyInstances(
          user!.uid,
          dateStr,
        );
      setInstances(loadedInstances);

      const loadedCommitments = await recurringCommitmentService.getCommitments(
        user!.uid,
      );
      setCommitments(loadedCommitments);
    } catch (e) {
      console.error("Failed to load recurring commitments", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async (
    instanceId: string,
    newValue: number,
    goalValue: number,
  ) => {
    try {
      const status = newValue >= goalValue ? "completed" : "active";
      await recurringCommitmentService.updateInstanceStatus(
        instanceId,
        status,
        newValue,
      );
      // Optimistic update
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === instanceId
            ? { ...inst, progressValue: newValue, status }
            : inst,
        ),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const getIconForCategory = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("water"))
      return <Droplets className="w-4 h-4 text-blue-500" />;
    if (t.includes("read"))
      return <BookOpen className="w-4 h-4 text-emerald-500" />;
    if (t.includes("gym") || t.includes("workout"))
      return <Dumbbell className="w-4 h-4 text-orange-500" />;
    if (t.includes("dsa") || t.includes("code"))
      return <Code className="w-4 h-4 text-indigo-500" />;
    return <Flame className="w-4 h-4 text-rose-500" />;
  };

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const handleDelete = async (commitmentId: string) => {
    if (confirmingDeleteId === commitmentId) {
      await recurringCommitmentService.archiveCommitment(commitmentId);
      setConfirmingDeleteId(null);
      loadData();
    } else {
      setConfirmingDeleteId(commitmentId);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => {
        setConfirmingDeleteId((prev) => (prev === commitmentId ? null : prev));
      }, 3000);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recurringCommitmentService.createCommitment(user.uid, {
        title: newTitle.trim(),
        description: "",
        repeatRule: "daily",
        goalValue: 1,
        goalUnit: "Times",
        completionMode: "binary",
        estimatedDurationMinutes: 15,
      });
      setNewTitle("");
      setIsAdding(false);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-full"></div>
        <div className="h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100 uppercase">
          Daily Commitments
        </h2>
        <button className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <Reorder.Group axis="y" values={instances} onReorder={setInstances} className="space-y-3">
        <AnimatePresence>
          {instances.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400 bg-white/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/50 rounded-2xl"
            >
              No commitments scheduled for today. Add one to build a habit.
            </motion.div>
          )}

          {instances.map((instance) => {
            const commitment = commitments.find(
              (c) => c.id === instance.commitmentId,
            );
            const isCompleted = instance.status === "completed";
            const progressPercent = Math.min(
              100,
              Math.round((instance.progressValue / instance.goalValue) * 100),
            );

            return (
              <Reorder.Item
                value={instance}
                key={instance.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`relative overflow-hidden p-4 rounded-2xl border transition-all duration-300 ${
                  isCompleted
                    ? "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200/50 dark:border-zinc-800/30 opacity-70 grayscale-[30%]"
                    : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-indigo-500/30 dark:hover:border-indigo-500/30"
                }`}
              >
                {/* Progress bar background */}
                {!isCompleted && instance.goalValue > 1 && (
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-indigo-50/50 dark:bg-indigo-900/10 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                )}

                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        handleUpdateProgress(
                          instance.id,
                          isCompleted ? 0 : instance.goalValue,
                          instance.goalValue,
                        )
                      }
                      className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
                        isCompleted
                          ? "text-indigo-500"
                          : "text-zinc-300 hover:text-indigo-400 dark:text-zinc-600 dark:hover:text-indigo-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        {getIconForCategory(instance.title)}
                        <h3
                          className={`text-[13px] font-semibold ${isCompleted ? "text-zinc-500 line-through" : "text-zinc-900 dark:text-zinc-100"}`}
                        >
                          {instance.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        {commitment && commitment.currentStreak > 0 && (
                          <span className="text-[10px] font-medium text-rose-500 flex items-center gap-1">
                            <Flame className="w-3 h-3" />{" "}
                            {commitment.currentStreak} Day Streak
                          </span>
                        )}
                        {!isCompleted && instance.goalValue > 1 && (
                          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                            {instance.progressValue} / {instance.goalValue}{" "}
                            {instance.goalUnit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isCompleted && instance.goalValue > 1 && (
                      <button
                        onClick={() =>
                          handleUpdateProgress(
                            instance.id,
                            Math.min(
                              instance.progressValue + 1,
                              instance.goalValue,
                            ),
                            instance.goalValue,
                          )
                        }
                        className="px-2 py-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 rounded-md transition-colors"
                      >
                        +1
                      </button>
                    )}
                    {commitment && (
                      <button
                        onClick={() => handleDelete(commitment.id)}
                        className={`p-1 transition-colors ${
                          confirmingDeleteId === commitment.id
                            ? "text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded px-2 text-xs font-medium"
                            : "text-zinc-300 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-500"
                        }`}
                        title={confirmingDeleteId === commitment.id ? "Click again to confirm" : "Delete habit"}
                      >
                        {confirmingDeleteId === commitment.id ? "Confirm?" : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                    <div className="cursor-grab active:cursor-grabbing p-1 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400">
                      <GripVertical className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Reorder.Item>
            );
          })}
        </AnimatePresence>
      </Reorder.Group>

      {isAdding ? (
        <form
          onSubmit={handleQuickAdd}
          className="mt-4 p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Read 20 pages"
            className="w-full bg-transparent border-none focus:outline-none text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 mb-2 disabled:opacity-50"
            autoFocus
            disabled={isSubmitting}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || isSubmitting}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Habit"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="mt-3 w-full py-2.5 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 dark:hover:text-zinc-300 dark:hover:bg-zinc-800/50 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Quick add recurring habit
        </button>
      )}
    </div>
  );
}
