import { Task, DependencyStatus } from "../types.js";

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DependencyGraph {
  taskMap: Map<string, Task>;
  /** Map from taskId -> array of taskIds that DEPEND on taskId (downstream targets) */
  downstreamMap: Map<string, string[]>;
  /** Map from taskId -> array of taskIds that taskId DEPENDS ON (upstream prerequisites) */
  upstreamMap: Map<string, string[]>;
}

/**
  * Helper to determine if a task is fully completed.
  * A task is completed if task.isCompleted is explicitly true OR all of its subtasks are done (if subtasks exist).
  */
export function isTaskCompleted(task: Task): boolean {
  if (task.isCompleted) return true;
  if (task.subtasks && task.subtasks.length > 0) {
    return task.subtasks.every((s) => s.done);
  }
  return false;
}

/**
  * Sanitizes and normalizes the dependsOn array by removing duplicates and whitespace.
  */
export function sanitizeDependencies(dependsOn?: string[]): string[] {
  if (!dependsOn || !Array.isArray(dependsOn)) return [];
  const cleaned = dependsOn.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean);
  return Array.from(new Set(cleaned));
}

/**
  * Builds an adjacency graph representation of tasks and their cross-task dependencies.
  */
export function buildGraph(tasks: Task[]): DependencyGraph {
  const taskMap = new Map<string, Task>();
  const downstreamMap = new Map<string, string[]>();
  const upstreamMap = new Map<string, string[]>();

  // Register all tasks
  for (const task of tasks) {
    taskMap.set(task.id, task);
    downstreamMap.set(task.id, []);
    upstreamMap.set(task.id, []);
  }

  // Populate edges
  for (const task of tasks) {
    const deps = sanitizeDependencies(task.dependsOn);
    upstreamMap.set(task.id, deps);

    for (const parentId of deps) {
      if (taskMap.has(parentId)) {
        const existing = downstreamMap.get(parentId) || [];
        existing.push(task.id);
        downstreamMap.set(parentId, existing);
      }
    }
  }

  return { taskMap, downstreamMap, upstreamMap };
}

/**
  * Detects directed cycles in a list of tasks.
  * Returns an object indicating whether a cycle exists and the cycle path if found.
  */
export function detectCycles(tasks: Task[]): { hasCycle: boolean; cyclePath?: string[] } {
  const graph = buildGraph(tasks);
  const visited = new Map<string, 0 | 1 | 2>(); // 0: unvisited, 1: visiting (gray), 2: visited (black)
  const parentTrack = new Map<string, string>();
  let cyclePath: string[] | undefined = undefined;

  for (const taskId of graph.taskMap.keys()) {
    visited.set(taskId, 0);
  }

  function dfs(currId: string, path: string[]): boolean {
    visited.set(currId, 1);
    path.push(currId);

    const downstream = graph.downstreamMap.get(currId) || [];
    // Sort downstream IDs deterministically to ensure stable traversal
    const sortedDownstream = [...downstream].sort();

    for (const nextId of sortedDownstream) {
      const state = visited.get(nextId) || 0;
      if (state === 1) {
        // Found cycle!
        const cycleStartIndex = path.indexOf(nextId);
        cyclePath = [...path.slice(cycleStartIndex), nextId];
        return true;
      }
      if (state === 0) {
        parentTrack.set(nextId, currId);
        if (dfs(nextId, path)) return true;
      }
    }

    visited.set(currId, 2);
    path.pop();
    return false;
  }

  // Iterate deterministically through task IDs
  const sortedTaskIds = Array.from(graph.taskMap.keys()).sort();
  for (const taskId of sortedTaskIds) {
    if (visited.get(taskId) === 0) {
      if (dfs(taskId, [])) {
        return { hasCycle: true, cyclePath };
      }
    }
  }

  return { hasCycle: false };
}

/**
  * Validates a candidate task (or updated task) against the current task set.
  * Rejects self-dependencies, missing dependencies, duplicate IDs, and circular dependencies.
  */
export function validateDependencies(
  candidateTask: Partial<Task> & { id: string },
  existingTasks: Task[]
): GraphValidationResult {
  const errors: string[] = [];
  const candidateId = candidateTask.id;
  const rawDeps = candidateTask.dependsOn || [];

  // 1. Check duplicate dependency IDs
  const seenDeps = new Set<string>();
  for (const depId of rawDeps) {
    if (seenDeps.has(depId)) {
      errors.push(`Duplicate dependency entry detected: '${depId}'.`);
    }
    seenDeps.add(depId);
  }

  const cleanDeps = Array.from(seenDeps);

  // 2. Check self-dependency
  if (cleanDeps.includes(candidateId)) {
    errors.push(`Task '${candidateId}' cannot depend on itself.`);
  }

  // Build combined task list for validation
  const otherTasks = existingTasks.filter((t) => t.id !== candidateId);
  const existingMap = new Map(otherTasks.map((t) => [t.id, t]));

  // 3. Check missing dependencies
  for (const depId of cleanDeps) {
    if (!existingMap.has(depId)) {
      errors.push(`Prerequisite task '${depId}' does not exist in the codebase.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Construct hypothetical task object
  const fullCandidateTask: Task = {
    ...(existingTasks.find((t) => t.id === candidateId) || {
      id: candidateId,
      userId: candidateTask.userId || "system",
      title: candidateTask.title || "Untitled Task",
      description: candidateTask.description || "",
      complexity: candidateTask.complexity || "medium",
      totalEffortMinutes: candidateTask.totalEffortMinutes || 60,
      riskScore: 0,
      riskZone: "safe",
      deadline: candidateTask.deadline || new Date().toISOString(),
      subtasks: candidateTask.subtasks || [],
      sessionsCompleted: 0,
      sessionsPlanned: 0,
      riskFactors: [],
      createdAt: new Date().toISOString(),
      googleCalendarSynced: false,
      googleTasksSynced: false,
    }),
    ...candidateTask,
    dependsOn: cleanDeps,
  };

  const combinedTasks = [...otherTasks, fullCandidateTask];

  // 4. Check for circular dependencies
  const cycleResult = detectCycles(combinedTasks);
  if (cycleResult.hasCycle) {
    const cycleStr = cycleResult.cyclePath ? cycleResult.cyclePath.join(" -> ") : "unknown cycle";
    errors.push(`Circular dependency detected: ${cycleStr}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
  * Deterministic Tie-Breaking Comparator for Task Ordering.
  * Priority: High > Medium > Low
  * Deadline: Earlier > Later
  * CreatedAt: Earlier > Later
  * Task ID: String lexical comparison
  */
export function compareTasksDeterministically(a: Task, b: Task): number {
  const priorityScore = { high: 3, medium: 2, low: 1 };
  const pA = priorityScore[a.priority || "medium"] || 2;
  const pB = priorityScore[b.priority || "medium"] || 2;
  if (pA !== pB) return pB - pA; // Higher priority first

  const dA = new Date(a.deadline).getTime();
  const dB = new Date(b.deadline).getTime();
  if (dA !== dB) return dA - dB; // Earlier deadline first

  const cA = new Date(a.createdAt || 0).getTime();
  const cB = new Date(b.createdAt || 0).getTime();
  if (cA !== cB) return cA - cB; // Earlier creation date first

  return a.id.localeCompare(b.id); // Stable tie-breaker
}

/**
  * Performs a deterministic Topological Sort on a task graph using Kahn's Algorithm.
  */
export function topologicalSort(tasks: Task[]): { sortedTasks: Task[]; hasCycle: boolean } {
  const graph = buildGraph(tasks);
  const inDegreeMap = new Map<string, number>();

  for (const taskId of graph.taskMap.keys()) {
    const upstream = graph.upstreamMap.get(taskId) || [];
    inDegreeMap.set(taskId, upstream.length);
  }

  // Queue initialized with all zero-indegree tasks
  const readyQueue: Task[] = [];
  for (const [taskId, inDegree] of inDegreeMap.entries()) {
    if (inDegree === 0) {
      readyQueue.push(graph.taskMap.get(taskId)!);
    }
  }

  // Sort initial queue deterministically
  readyQueue.sort(compareTasksDeterministically);

  const sortedTasks: Task[] = [];

  while (readyQueue.length > 0) {
    // Pop the highest priority / deterministic task
    const currTask = readyQueue.shift()!;
    sortedTasks.push(currTask);

    const downstreamIds = graph.downstreamMap.get(currTask.id) || [];
    const newlyReady: Task[] = [];

    for (const downId of downstreamIds) {
      const currentInDegree = inDegreeMap.get(downId)! - 1;
      inDegreeMap.set(downId, currentInDegree);

      if (currentInDegree === 0) {
        newlyReady.push(graph.taskMap.get(downId)!);
      }
    }

    if (newlyReady.length > 0) {
      readyQueue.push(...newlyReady);
      readyQueue.sort(compareTasksDeterministically);
    }
  }

  const hasCycle = sortedTasks.length !== tasks.length;
  return { sortedTasks, hasCycle };
}

/**
  * Calculates the exact dependency state of a task.
  * States: COMPLETED | BLOCKED | OVERDUE | IN_PROGRESS | READY
  */
export function getTaskDependencyStatus(task: Task, tasks: Task[]): DependencyStatus {
  if (isTaskCompleted(task)) {
    return "COMPLETED";
  }

  const graph = buildGraph(tasks);
  const upstreamIds = graph.upstreamMap.get(task.id) || [];

  // Check if any upstream prerequisite is NOT completed
  const hasUncompletedPrereq = upstreamIds.some((parentKey) => {
    const parentTask = graph.taskMap.get(parentKey);
    if (!parentTask) return true; // Missing parent = blocked
    return !isTaskCompleted(parentTask);
  });

  if (hasUncompletedPrereq) {
    return "BLOCKED";
  }

  // Check overdue state
  const deadlineNum = new Date(task.deadline).getTime();
  if (!isNaN(deadlineNum) && deadlineNum < Date.now()) {
    return "OVERDUE";
  }

  // Check in progress state (some subtasks done)
  if (task.subtasks && task.subtasks.some((s) => s.done)) {
    return "IN_PROGRESS";
  }

  return "READY";
}

/**
  * Returns all tasks that are currently READY to be worked on (unblocked).
  */
export function getReadyTasks(tasks: Task[]): Task[] {
  const ready = tasks.filter((t) => {
    const status = getTaskDependencyStatus(t, tasks);
    return status === "READY" || status === "IN_PROGRESS";
  });
  return ready.sort(compareTasksDeterministically);
}

/**
  * Returns all tasks that are currently BLOCKED by uncompleted prerequisites.
  */
export function getBlockedTasks(tasks: Task[]): Task[] {
  const blocked = tasks.filter((t) => getTaskDependencyStatus(t, tasks) === "BLOCKED");
  return blocked.sort(compareTasksDeterministically);
}

/**
  * Returns all direct and indirect upstream prerequisites for a given task (transitive closure).
  */
export function getUpstreamDependencies(taskId: string, tasks: Task[]): Task[] {
  const graph = buildGraph(tasks);
  const resultIds = new Set<string>();
  const queue = [...(graph.upstreamMap.get(taskId) || [])];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (!resultIds.has(currId)) {
      resultIds.add(currId);
      const parents = graph.upstreamMap.get(currId) || [];
      for (const p of parents) {
        if (!resultIds.has(p)) queue.push(p);
      }
    }
  }

  const upstreamTasks = Array.from(resultIds)
    .map((id) => graph.taskMap.get(id)!)
    .filter(Boolean);

  return upstreamTasks.sort(compareTasksDeterministically);
}

/**
  * Returns all direct and indirect downstream tasks that depend on a given task (transitive closure).
  * Essential for Phase 3 automatic rescheduling.
  */
export function getDownstreamDependents(taskId: string, tasks: Task[]): Task[] {
  const graph = buildGraph(tasks);
  const resultIds = new Set<string>();
  const queue = [...(graph.downstreamMap.get(taskId) || [])];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (!resultIds.has(currId)) {
      resultIds.add(currId);
      const children = graph.downstreamMap.get(currId) || [];
      for (const c of children) {
        if (!resultIds.has(c)) queue.push(c);
      }
    }
  }

  const downstreamTasks = Array.from(resultIds)
    .map((id) => graph.taskMap.get(id)!)
    .filter(Boolean);

  return downstreamTasks.sort(compareTasksDeterministically);
}
