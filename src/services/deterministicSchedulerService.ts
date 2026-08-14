import { Task, Subtask } from "../types.js";
import {
  topologicalSort,
  buildGraph,
  getTaskDependencyStatus,
  isTaskCompleted,
  getDownstreamDependents,
} from "../lib/dependencyGraph.js";
import { computeRiskScore } from "../lib/riskEngine.js";

export interface TimeInterval {
  start: Date;
  end: Date;
  summary?: string;
}

export interface ScheduleOptions {
  /** Injected reference time. Mandatory for test determinism. Defaults to current Date in production. */
  now?: Date | string;
  preferredStartHour?: number; // 0-23 (default: 9 AM)
  preferredEndHour?: number;   // 0-23 (default: 21 / 9 PM)
  maxFocusDurationMinutes?: number; // default: 90 minutes
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  busyIntervals?: { start: string; end: string; summary?: string }[];
  strategy?: "balanced" | "deadline_first" | "deep_work" | "recovery_optimized";
}

export interface ScheduleConflict {
  taskId: string;
  taskTitle: string;
  type: "HARD_DEADLINE_VIOLATION" | "INSUFFICIENT_CAPACITY" | "DEPENDENCY_CYCLE" | "EXPIRED_DEADLINE";
  message: string;
  deadline?: string;
  requiredMinutes?: number;
  availableMinutes?: number;
}

export interface ScheduleResult {
  status: "SUCCESS" | "OVERLOAD" | "CONFLICT";
  scheduledTasks: Task[];
  conflicts: ScheduleConflict[];
  unallocatedTasks: Task[];
  totalEffortMinutes: number;
  availableCapacityMinutes: number;
  scheduleInsights: string[];
  scheduledAt: string;
}

/**
  * Helper to parse time string "HH:MM" into minutes from midnight.
  */
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0] || "0", 10);
  const minutes = parseInt(parts[1] || "0", 10);
  return hours * 60 + minutes;
}

/**
  * Checks if a target date/time falls within quiet hours.
  */
export function isTimeInQuietHours(date: Date, quietHours?: { enabled: boolean; start: string; end: string }): boolean {
  if (!quietHours || !quietHours.enabled) return false;
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMin = parseTimeToMinutes(quietHours.start);
  const endMin = parseTimeToMinutes(quietHours.end);

  if (startMin < endMin) {
    return currentMinutes >= startMin && currentMinutes < endMin;
  } else {
    // Crosses midnight (e.g. 22:00 to 08:00)
    return currentMinutes >= startMin || currentMinutes < endMin;
  }
}

/**
  * Deterministic Task Priority Ordering for Scheduling.
  * 1. Risk Zone: Critical (70+) > Watch (40+) > Safe
  * 2. Hard Deadline: isHardDeadline === true > false
  * 3. Downstream Dependency Count (tasks blocking more dependents go first)
  * 4. Priority: high (3) > medium (2) > low (1)
  * 5. Deadline: Earlier > Later
  * 6. CreatedAt: Earlier > Later
  * 7. ID: Stable lexical string comparison
  */
function isPrerequisiteForCriticalHard(taskId: string, tasks: Task[]): boolean {
  const downstreamTasks = getDownstreamDependents(taskId, tasks);
  for (const downTask of downstreamTasks) {
    if (downTask && (downTask.commitmentType === "HARD" || downTask.isHardDeadline)) {
      const risk = computeRiskScore(downTask);
      if (risk.zone === "critical" || risk.score >= 50) {
        return true;
      }
    }
  }
  return false;
}

export function compareTasksForScheduling(a: Task, b: Task, tasks: Task[]): number {
  const riskA = computeRiskScore(a);
  const riskB = computeRiskScore(b);

  // Phase 6 Dependency-Aware Critical Override: Prerequisite chain of Critical HARD commitment inherits top priority
  const critA = (a.commitmentType === "HARD" || a.isHardDeadline || isPrerequisiteForCriticalHard(a.id, tasks)) ? 1 : 0;
  const critB = (b.commitmentType === "HARD" || b.isHardDeadline || isPrerequisiteForCriticalHard(b.id, tasks)) ? 1 : 0;

  if (critA !== critB) {
    return critB - critA;
  }

  const zoneScore = { critical: 3, watch: 2, safe: 1 };
  if (zoneScore[riskA.zone] !== zoneScore[riskB.zone]) {
    return zoneScore[riskB.zone] - zoneScore[riskA.zone];
  }

  // Hard commitment / hard deadline priority
  const hardA = (a.commitmentType === "HARD" || a.isHardDeadline) ? 1 : 0;
  const hardB = (b.commitmentType === "HARD" || b.isHardDeadline) ? 1 : 0;
  if (hardA !== hardB) {
    return hardB - hardA;
  }

  // Downstream impact count (transitive closure)
  const downA = getDownstreamDependents(a.id, tasks).length;
  const downB = getDownstreamDependents(b.id, tasks).length;
  if (downA !== downB) {
    return downB - downA;
  }

  // User explicit priority
  const priorityScore = { high: 3, medium: 2, low: 1 };
  const pA = priorityScore[a.priority || "medium"] || 2;
  const pB = priorityScore[b.priority || "medium"] || 2;
  if (pA !== pB) {
    return pB - pA;
  }

  // Earliest deadline
  const dA = new Date(a.deadline).getTime();
  const dB = new Date(b.deadline).getTime();
  if (dA !== dB) {
    return dA - dB;
  }

  // Creation date
  const cA = new Date(a.createdAt || 0).getTime();
  const cB = new Date(b.createdAt || 0).getTime();
  if (cA !== cB) {
    return cA - cB;
  }

  // Stable task ID tie-breaker
  return a.id.localeCompare(b.id);
}

export class DeterministicSchedulerService {
  /**
    * Main entry point for deterministic task scheduling.
    * Takes tasks and options, returns a fully deterministic ScheduleResult.
    */
  public scheduleTasks(inputTasks: Task[], options: ScheduleOptions = {}): ScheduleResult {
    // 1. Establish fixed reference time 'nowDate'
    const nowDate = options.now
      ? new Date(options.now)
      : new Date();

    if (isNaN(nowDate.getTime())) {
      throw new Error(`Invalid reference time 'now' provided: ${options.now}`);
    }

    const startHour = options.preferredStartHour ?? 9;
    const endHour = options.preferredEndHour ?? 21;
    const maxFocus = options.maxFocusDurationMinutes ?? 90;

    // Parse busy intervals
    const busyIntervals: TimeInterval[] = (options.busyIntervals || [])
      .map((b) => ({
        start: new Date(b.start),
        end: new Date(b.end),
        summary: b.summary,
      }))
      .filter((b) => !isNaN(b.start.getTime()) && !isNaN(b.end.getTime()));

    // Sort busy intervals chronologically
    busyIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());

    // 2. Clone tasks to prevent mutating caller references
    const tasks: Task[] = JSON.parse(JSON.stringify(inputTasks));
    const conflicts: ScheduleConflict[] = [];
    const insights: string[] = [];

    if (tasks.length === 0) {
      return {
        status: "SUCCESS",
        scheduledTasks: [],
        conflicts: [],
        unallocatedTasks: [],
        totalEffortMinutes: 0,
        availableCapacityMinutes: 0,
        scheduleInsights: ["No active tasks provided for scheduling."],
        scheduledAt: nowDate.toISOString(),
      };
    }

    // 3. Topological Dependency Sort & Cycle Validation
    const topoResult = topologicalSort(tasks);
    if (topoResult.hasCycle) {
      return {
        status: "CONFLICT",
        scheduledTasks: tasks,
        conflicts: [
          {
            taskId: "GLOBAL_CYCLE",
            taskTitle: "Dependency Graph Error",
            type: "DEPENDENCY_CYCLE",
            message: "Cannot generate schedule due to circular task dependencies.",
          },
        ],
        unallocatedTasks: tasks,
        totalEffortMinutes: tasks.reduce((sum, t) => sum + t.totalEffortMinutes, 0),
        availableCapacityMinutes: 0,
        scheduleInsights: ["Circular dependency detected. Schedule aborted for safety."],
        scheduledAt: nowDate.toISOString(),
      };
    }

    // 4. Map completed status and calculate completed subtasks
    const graph = buildGraph(tasks);

    // Map to track completion end times of tasks: taskId -> Date
    const taskCompletionMap = new Map<string, Date>();
    for (const task of tasks) {
      if (isTaskCompleted(task)) {
        // If task completed, mark completion time as past or creation time
        taskCompletionMap.set(task.id, new Date(task.createdAt || nowDate));
      }
    }

    // Track occupied time slots: array of occupied intervals
    const occupiedSlots: TimeInterval[] = [...busyIntervals];

    let totalEffortMinutes = 0;
    const unscheduledTasks: Task[] = [];
    const scheduledTasks: Task[] = [];

    // Helper to find next valid time slot of length `durationMins` after `earliestStart`
    function findNextAvailableSlot(earliestStart: Date, durationMins: number): { start: Date; end: Date } {
      let cursor = new Date(Math.max(nowDate.getTime(), earliestStart.getTime()));

      // Align cursor to avoid scheduling in the past relative to nowDate
      if (cursor.getTime() < nowDate.getTime()) {
        cursor = new Date(nowDate.getTime());
      }

      while (true) {
        // Enforce working hours (e.g. 09:00 to 21:00)
        const hour = cursor.getHours();
        if (hour < startHour) {
          cursor.setHours(startHour, 0, 0, 0);
        } else if (hour >= endHour) {
          // Advance to startHour of next day
          cursor.setDate(cursor.getDate() + 1);
          cursor.setHours(startHour, 0, 0, 0);
        }

        // Check Quiet Hours
        if (isTimeInQuietHours(cursor, options.quietHours)) {
          // Advance by 15 minutes
          cursor.setMinutes(cursor.getMinutes() + 15);
          continue;
        }

        const candidateEnd = new Date(cursor.getTime() + durationMins * 60000);

        // Verify candidateEnd stays within working hours for the same day block
        const candidateEndHour = candidateEnd.getHours();
        const candidateEndMin = candidateEnd.getMinutes();
        if (
          candidateEndHour > endHour ||
          (candidateEndHour === endHour && candidateEndMin > 0) ||
          candidateEnd.getDate() !== cursor.getDate()
        ) {
          // Cannot fit before end of working day, move to start of next day
          cursor.setDate(cursor.getDate() + 1);
          cursor.setHours(startHour, 0, 0, 0);
          continue;
        }

        // Verify collision with occupied slots (busy intervals or previously scheduled tasks)
        let collision = false;
        for (const busy of occupiedSlots) {
          if (cursor.getTime() < busy.end.getTime() && candidateEnd.getTime() > busy.start.getTime()) {
            // Collision detected! Move cursor past this busy slot
            cursor = new Date(busy.end.getTime());
            collision = true;
            break;
          }
        }

        if (!collision) {
          return { start: cursor, end: candidateEnd };
        }
      }
    }

    // 5. Process tasks in topological dependency order combined with priority ranking
    // Group active tasks into ready vs blocked queues
    const activeTasks = topoResult.sortedTasks.filter((t) => !isTaskCompleted(t));

    // Sort active tasks using compareTasksForScheduling while respecting DAG topological boundaries
    // We process tasks by iteratively picking ready tasks that have 0 uncompleted prerequisites
    const processedTaskIds = new Set<string>(
      tasks.filter((t) => isTaskCompleted(t)).map((t) => t.id)
    );

    const schedulableList: Task[] = [];
    const remainingActive = [...activeTasks];

    while (remainingActive.length > 0) {
      // Find all tasks whose prerequisites are in processedTaskIds
      const readyCandidates = remainingActive.filter((t) => {
        const upstream = graph.upstreamMap.get(t.id) || [];
        return upstream.every((uId) => processedTaskIds.has(uId));
      });

      if (readyCandidates.length === 0) {
        // Fallback safety (should not happen if topoResult has no cycle)
        schedulableList.push(...remainingActive);
        break;
      }

      // Sort ready candidates deterministically by priority, risk, deadline, depth
      readyCandidates.sort((a, b) => compareTasksForScheduling(a, b, tasks));

      // Pick the top candidate
      const selected = readyCandidates[0];
      schedulableList.push(selected);
      processedTaskIds.add(selected.id);

      // Remove selected from remainingActive
      const selIdx = remainingActive.findIndex((t) => t.id === selected.id);
      if (selIdx !== -1) remainingActive.splice(selIdx, 1);
    }

    // 6. Allocate Slots for each task in schedulableList
    for (const task of schedulableList) {
      // Calculate earliest start based on prerequisite completion times
      const upstreamIds = graph.upstreamMap.get(task.id) || [];
      let earliestStart = new Date(nowDate.getTime());

      for (const parentId of upstreamIds) {
        const parentEndTime = taskCompletionMap.get(parentId);
        if (parentEndTime && parentEndTime.getTime() > earliestStart.getTime()) {
          earliestStart = new Date(parentEndTime.getTime());
        }
      }

      let taskStart: Date | null = null;
      let taskEnd: Date | null = null;

      // Subtasks handling & splitting if estimatedMinutes > maxFocus
      const updatedSubtasks: Subtask[] = [];
      let taskEffort = 0;

      // Split subtasks if necessary
      const subtaskBlocks: { title: string; estimatedMinutes: number; originalSubtaskId?: string }[] = [];
      for (const sub of task.subtasks) {
        if (sub.done) {
          updatedSubtasks.push(sub);
          continue;
        }

        let remainingMins = sub.estimatedMinutes || 45;
        taskEffort += remainingMins;

        if (remainingMins > maxFocus) {
          let chunkIndex = 1;
          while (remainingMins > 0) {
            const chunkMins = Math.min(remainingMins, maxFocus);
            subtaskBlocks.push({
              title: `${sub.title} (Part ${chunkIndex})`,
              estimatedMinutes: chunkMins,
              originalSubtaskId: sub.id,
            });
            remainingMins -= chunkMins;
            chunkIndex++;
          }
        } else {
          subtaskBlocks.push({
            title: sub.title,
            estimatedMinutes: remainingMins,
            originalSubtaskId: sub.id,
          });
        }
      }

      totalEffortMinutes += taskEffort;

      // Schedule each active subtask block
      let currentCursor = new Date(earliestStart.getTime());

      for (const [idx, block] of subtaskBlocks.entries()) {
        const slot = findNextAvailableSlot(currentCursor, block.estimatedMinutes);

        if (!taskStart) taskStart = slot.start;
        taskEnd = slot.end;

        // Occupy interval
        occupiedSlots.push({ start: slot.start, end: slot.end, summary: `${task.title}: ${block.title}` });
        occupiedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Update subtask with scheduled timestamps, preserving existing googleEventId
        const origSub = task.subtasks.find((s) => s.id === block.originalSubtaskId);
        updatedSubtasks.push({
          id: block.originalSubtaskId || `sub_split_${Date.now()}_${idx}`,
          title: block.title,
          estimatedMinutes: block.estimatedMinutes,
          done: false,
          order: idx + 1,
          scheduledStart: slot.start.toISOString(),
          scheduledEnd: slot.end.toISOString(),
          googleEventId: origSub?.googleEventId,
          syncError: origSub?.syncError,
          adaptiveExplanation: `Deterministically scheduled block [${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]`,
        });

        // Next subtask starts after this slot
        currentCursor = new Date(slot.end.getTime());
      }

      const finalTaskEnd = taskEnd || earliestStart;
      taskCompletionMap.set(task.id, finalTaskEnd);

      // Verify Hard Deadline Constraints
      const deadlineDate = new Date(task.deadline);
      const isDeadlineViolated = !isNaN(deadlineDate.getTime()) && finalTaskEnd.getTime() > deadlineDate.getTime();

      if (isDeadlineViolated) {
        if (task.isHardDeadline) {
          conflicts.push({
            taskId: task.id,
            taskTitle: task.title,
            type: "HARD_DEADLINE_VIOLATION",
            message: `Hard deadline violation: Scheduled completion (${finalTaskEnd.toISOString()}) exceeds non-negotiable deadline (${task.deadline}).`,
            deadline: task.deadline,
            requiredMinutes: taskEffort,
          });
        } else {
          insights.push(`Flexible commitment '${task.title}' projected to finish past target deadline.`);
        }
      }

      const scheduledTask: Task = {
        ...task,
        subtasks: updatedSubtasks,
        googleCalendarSynced: task.googleCalendarSynced || false,
      };

      scheduledTasks.push(scheduledTask);
    }

    // 7. Calculate Available Working Hours Capacity in minutes from nowDate to furthest deadline
    let furthestDeadlineMs = tasks.reduce((max, t) => {
      const d = new Date(t.deadline).getTime();
      return !isNaN(d) && d > max ? d : max;
    }, 0);

    if (furthestDeadlineMs === 0 || furthestDeadlineMs < nowDate.getTime()) {
      furthestDeadlineMs = nowDate.getTime() + 7 * 86400000; // default 7 days horizon
    }

    const horizonDays = Math.max(1, (furthestDeadlineMs - nowDate.getTime()) / (86400000));
    const dailyWorkingMinutes = Math.max(1, (endHour - startHour) * 60);
    const totalBusyMinutes = busyIntervals.reduce((sum, b) => {
      const mins = Math.max(0, (b.end.getTime() - b.start.getTime()) / 60000);
      return sum + Math.min(dailyWorkingMinutes, mins);
    }, 0);
    const availableCapacityMinutes = Math.max(0, Math.floor(horizonDays * dailyWorkingMinutes - totalBusyMinutes));

    let status: "SUCCESS" | "OVERLOAD" | "CONFLICT" = "SUCCESS";
    if (conflicts.some((c) => c.type === "HARD_DEADLINE_VIOLATION" || c.type === "DEPENDENCY_CYCLE")) {
      status = "CONFLICT";
    } else if (totalEffortMinutes > availableCapacityMinutes) {
      status = "OVERLOAD";
      insights.push(`Overload Warning: Total required effort (${totalEffortMinutes} mins) exceeds available working capacity (${availableCapacityMinutes} mins).`);
    }

    insights.unshift(`Deterministic schedule computed successfully for ${scheduledTasks.length} commitments.`);

    return {
      status,
      scheduledTasks,
      conflicts,
      unallocatedTasks: unscheduledTasks,
      totalEffortMinutes,
      availableCapacityMinutes,
      scheduleInsights: insights,
      scheduledAt: nowDate.toISOString(),
    };
  }
}

export const deterministicSchedulerService = new DeterministicSchedulerService();
