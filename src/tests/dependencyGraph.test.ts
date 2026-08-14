import assert from "node:assert";
import { Task } from "../types.js";
import {
  buildGraph,
  detectCycles,
  validateDependencies,
  topologicalSort,
  getTaskDependencyStatus,
  getReadyTasks,
  getBlockedTasks,
  getUpstreamDependencies,
  getDownstreamDependents,
} from "../lib/dependencyGraph.js";

function createMockTask(id: string, dependsOn: string[] = [], done = false): Task {
  return {
    id,
    userId: "test-user",
    title: `Task ${id}`,
    description: `Description for ${id}`,
    complexity: "medium",
    totalEffortMinutes: 60,
    riskScore: 0,
    riskZone: "safe",
    deadline: new Date(Date.now() + 86400000).toISOString(), // 24h from now
    subtasks: [
      {
        id: `sub_${id}_1`,
        title: `Subtask ${id}.1`,
        estimatedMinutes: 60,
        done,
        order: 1,
      },
    ],
    sessionsCompleted: done ? 1 : 0,
    sessionsPlanned: 1,
    riskFactors: [],
    createdAt: new Date().toISOString(),
    googleCalendarSynced: false,
    googleTasksSynced: false,
    dependsOn,
    isCompleted: done,
  };
}

function runTests() {
  console.log("==========================================");
  console.log("RUNNING PHASE 1 DEPENDENCY ENGINE TESTS");
  console.log("==========================================");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Basic Single Task
  test("Single task with no dependencies is READY", () => {
    const taskA = createMockTask("A");
    const status = getTaskDependencyStatus(taskA, [taskA]);
    assert.strictEqual(status, "READY");
  });

  // 2. Simple Line DAG: A -> B
  test("Simple DAG (A -> B): A is READY, B is BLOCKED until A completes", () => {
    const taskA = createMockTask("A", [], false);
    const taskB = createMockTask("B", ["A"], false);
    const tasks = [taskA, taskB];

    assert.strictEqual(getTaskDependencyStatus(taskA, tasks), "READY");
    assert.strictEqual(getTaskDependencyStatus(taskB, tasks), "BLOCKED");

    const ready = getReadyTasks(tasks);
    const blocked = getBlockedTasks(tasks);
    assert.strictEqual(ready.length, 1);
    assert.strictEqual(ready[0].id, "A");
    assert.strictEqual(blocked.length, 1);
    assert.strictEqual(blocked[0].id, "B");
  });

  // 3. State Progression: A -> B -> C
  test("Chain DAG (A -> B -> C): Unblocking progression", () => {
    let taskA = createMockTask("A", [], false);
    let taskB = createMockTask("B", ["A"], false);
    let taskC = createMockTask("C", ["B"], false);
    let tasks = [taskA, taskB, taskC];

    // Initial state: A=READY, B=BLOCKED, C=BLOCKED
    assert.strictEqual(getTaskDependencyStatus(taskA, tasks), "READY");
    assert.strictEqual(getTaskDependencyStatus(taskB, tasks), "BLOCKED");
    assert.strictEqual(getTaskDependencyStatus(taskC, tasks), "BLOCKED");

    // Complete A -> B becomes READY, C remains BLOCKED
    taskA = createMockTask("A", [], true);
    tasks = [taskA, taskB, taskC];
    assert.strictEqual(getTaskDependencyStatus(taskA, tasks), "COMPLETED");
    assert.strictEqual(getTaskDependencyStatus(taskB, tasks), "READY");
    assert.strictEqual(getTaskDependencyStatus(taskC, tasks), "BLOCKED");

    // Complete B -> C becomes READY
    taskB = createMockTask("B", ["A"], true);
    tasks = [taskA, taskB, taskC];
    assert.strictEqual(getTaskDependencyStatus(taskB, tasks), "COMPLETED");
    assert.strictEqual(getTaskDependencyStatus(taskC, tasks), "READY");
  });

  // 4. Multiple Prerequisites: A and B -> C
  test("Multiple Prerequisites (A, B -> C): C requires both A and B to complete", () => {
    let taskA = createMockTask("A", [], true); // Done
    let taskB = createMockTask("B", [], false); // Not Done
    let taskC = createMockTask("C", ["A", "B"], false);
    let tasks = [taskA, taskB, taskC];

    // C is still BLOCKED because B is not done
    assert.strictEqual(getTaskDependencyStatus(taskC, tasks), "BLOCKED");

    // Complete B
    taskB = createMockTask("B", [], true);
    tasks = [taskA, taskB, taskC];

    // Now C is READY
    assert.strictEqual(getTaskDependencyStatus(taskC, tasks), "READY");
  });

  // 5. Downstream Propagation
  test("Downstream Impact Detection: A -> B -> C -> D", () => {
    const taskA = createMockTask("A", []);
    const taskB = createMockTask("B", ["A"]);
    const taskC = createMockTask("C", ["B"]);
    const taskD = createMockTask("D", ["C"]);
    const tasks = [taskA, taskB, taskC, taskD];

    const downstreamA = getDownstreamDependents("A", tasks);
    assert.deepStrictEqual(
      downstreamA.map((t) => t.id),
      ["B", "C", "D"]
    );

    const downstreamB = getDownstreamDependents("B", tasks);
    assert.deepStrictEqual(
      downstreamB.map((t) => t.id),
      ["C", "D"]
    );

    const upstreamD = getUpstreamDependencies("D", tasks);
    assert.deepStrictEqual(
      upstreamD.map((t) => t.id),
      ["A", "B", "C"]
    );
  });

  // 6. Invalid Graph: Self Dependency
  test("Reject self-dependency (A -> A)", () => {
    const taskA = createMockTask("A", []);
    const res = validateDependencies({ id: "A", dependsOn: ["A"] }, [taskA]);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("cannot depend on itself")));
  });

  // 7. Invalid Graph: Missing Dependency
  test("Reject missing dependency (A -> NonExistent)", () => {
    const res = validateDependencies({ id: "A", dependsOn: ["GHOST"] }, []);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("does not exist")));
  });

  // 8. Invalid Graph: Duplicate Dependencies
  test("Reject duplicate dependency IDs (dependsOn: ['B', 'B'])", () => {
    const taskB = createMockTask("B", []);
    const res = validateDependencies({ id: "A", dependsOn: ["B", "B"] }, [taskB]);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("Duplicate dependency entry detected")));
  });

  // 9. Invalid Graph: 2-Node Cycle (A -> B, B -> A)
  test("Reject 2-node cycle (A -> B -> A)", () => {
    const taskA = createMockTask("A", ["B"]);
    const taskB = createMockTask("B", ["A"]);
    const cycleRes = detectCycles([taskA, taskB]);
    assert.strictEqual(cycleRes.hasCycle, true);

    const valRes = validateDependencies({ id: "A", dependsOn: ["B"] }, [createMockTask("B", ["A"])]);
    assert.strictEqual(valRes.valid, false);
    assert.ok(valRes.errors.some((e) => e.includes("Circular dependency detected")));
  });

  // 10. Invalid Graph: 3-Node Cycle (A -> B -> C -> A)
  test("Reject 3-node cycle (A -> B -> C -> A)", () => {
    const taskA = createMockTask("A", ["C"]);
    const taskB = createMockTask("B", ["A"]);
    const taskC = createMockTask("C", ["B"]);
    const cycleRes = detectCycles([taskA, taskB, taskC]);
    assert.strictEqual(cycleRes.hasCycle, true);
  });

  // 11. Determinism Test
  test("Topological Sort is 100% deterministic across 100 iterations", () => {
    const taskA = createMockTask("A", []);
    const taskB = createMockTask("B", []);
    const taskC = createMockTask("C", ["A", "B"]);
    const taskD = createMockTask("D", ["C"]);

    // Scramble order in array input
    const tasksInput = [taskD, taskB, taskA, taskC];

    const firstRun = topologicalSort(tasksInput).sortedTasks.map((t) => t.id);

    for (let i = 0; i < 100; i++) {
      // Re-shuffle input array
      const shuffled = [...tasksInput].sort(() => Math.random() - 0.5);
      const run = topologicalSort(shuffled).sortedTasks.map((t) => t.id);
      assert.deepStrictEqual(run, firstRun, `Iteration ${i} produced non-deterministic output`);
    }
  });

  console.log("==========================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
