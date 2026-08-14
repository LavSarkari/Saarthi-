import assert from "node:assert";
import { Task } from "../types.js";
import {
  deterministicSchedulerService,
  isTimeInQuietHours,
} from "../services/deterministicSchedulerService.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";

function createMockTask(
  id: string,
  durationMinutes = 60,
  deadlineOffsetHours = 24,
  dependsOn: string[] = [],
  priority: "low" | "medium" | "high" = "medium",
  isHardDeadline = false
): Task {
  const deadlineDate = new Date(new Date(FIXTURE_NOW).getTime() + deadlineOffsetHours * 3600000);
  return {
    id,
    userId: "test-user",
    title: `Commitment ${id}`,
    description: `Description for ${id}`,
    complexity: "medium",
    priority,
    totalEffortMinutes: durationMinutes,
    riskScore: 0,
    riskZone: "safe",
    deadline: deadlineDate.toISOString(),
    subtasks: [
      {
        id: `sub_${id}_1`,
        title: `Subtask ${id}.1`,
        estimatedMinutes: durationMinutes,
        done: false,
        order: 1,
      },
    ],
    sessionsCompleted: 0,
    sessionsPlanned: 1,
    riskFactors: [],
    createdAt: "2026-08-15T08:00:00.000Z",
    googleCalendarSynced: false,
    googleTasksSynced: false,
    dependsOn,
    isHardDeadline,
  };
}

function runSchedulerTests() {
  console.log("=================================================");
  console.log("RUNNING PHASE 2 DETERMINISTIC SCHEDULER TESTS");
  console.log("=================================================");

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

  // Test 1 — Single Task
  test("Test 1: Single Task with sufficient time schedules successfully", () => {
    const taskA = createMockTask("A", 60);
    const res = deterministicSchedulerService.scheduleTasks([taskA], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "SUCCESS");
    assert.strictEqual(res.scheduledTasks.length, 1);
    const schedA = res.scheduledTasks[0];
    assert.ok(schedA.subtasks[0].scheduledStart);
    assert.ok(schedA.subtasks[0].scheduledEnd);
    assert.ok(new Date(schedA.subtasks[0].scheduledStart!) >= new Date(FIXTURE_NOW));
  });

  // Test 2 — Multiple Tasks Priority Ordering
  test("Test 2: Multiple tasks are scheduled deterministically by priority and deadline", () => {
    const taskLow = createMockTask("LOW", 60, 24, [], "low");
    const taskHigh = createMockTask("HIGH", 60, 24, [], "high");
    const res = deterministicSchedulerService.scheduleTasks([taskLow, taskHigh], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "SUCCESS");
    const startHigh = new Date(res.scheduledTasks.find((t) => t.id === "HIGH")!.subtasks[0].scheduledStart!).getTime();
    const startLow = new Date(res.scheduledTasks.find((t) => t.id === "LOW")!.subtasks[0].scheduledStart!).getTime();

    // High priority task must be scheduled before low priority task
    assert.ok(startHigh < startLow, "High priority task should start before low priority task");
  });

  // Test 3 — Dependency Chain A -> B -> C
  test("Test 3: Dependency Chain (A -> B -> C) maintains chronological order A < B < C", () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);
    const taskC = createMockTask("C", 60, 24, ["B"]);

    const res = deterministicSchedulerService.scheduleTasks([taskC, taskB, taskA], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "SUCCESS");
    const endA = new Date(res.scheduledTasks.find((t) => t.id === "A")!.subtasks[0].scheduledEnd!).getTime();
    const startB = new Date(res.scheduledTasks.find((t) => t.id === "B")!.subtasks[0].scheduledStart!).getTime();
    const endB = new Date(res.scheduledTasks.find((t) => t.id === "B")!.subtasks[0].scheduledEnd!).getTime();
    const startC = new Date(res.scheduledTasks.find((t) => t.id === "C")!.subtasks[0].scheduledStart!).getTime();

    assert.ok(endA <= startB, `Task A end (${endA}) must be <= Task B start (${startB})`);
    assert.ok(endB <= startC, `Task B end (${endB}) must be <= Task C start (${startC})`);
  });

  // Test 4 — Multiple Dependencies (A, B -> C)
  test("Test 4: Multiple Prerequisites (A, B -> C): C starts only after max(A.end, B.end)", () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 120, 24, []);
    const taskC = createMockTask("C", 60, 24, ["A", "B"]);

    const res = deterministicSchedulerService.scheduleTasks([taskA, taskB, taskC], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "SUCCESS");
    const endA = new Date(res.scheduledTasks.find((t) => t.id === "A")!.subtasks[0].scheduledEnd!).getTime();
    const endB = new Date(res.scheduledTasks.find((t) => t.id === "B")!.subtasks[0].scheduledEnd!).getTime();
    const startC = new Date(res.scheduledTasks.find((t) => t.id === "C")!.subtasks[0].scheduledStart!).getTime();

    const maxPrereqEnd = Math.max(endA, endB);
    assert.ok(startC >= maxPrereqEnd, `Task C start (${startC}) must be >= max prereq end (${maxPrereqEnd})`);
  });

  // Test 5 — Calendar Conflict Avoidance
  test("Test 5: Busy interval blocks earliest slot and shifts task to next open slot", () => {
    const taskA = createMockTask("A", 60, 24, []);
    // Busy block from 09:00 to 10:00 on day of FIXTURE_NOW
    const busyStart = "2026-08-15T09:00:00.000Z";
    const busyEnd = "2026-08-15T10:00:00.000Z";

    const res = deterministicSchedulerService.scheduleTasks([taskA], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals: [{ start: busyStart, end: busyEnd, summary: "Team Sync" }],
    });

    assert.strictEqual(res.status, "SUCCESS");
    const startA = new Date(res.scheduledTasks[0].subtasks[0].scheduledStart!).getTime();
    const busyEndMs = new Date(busyEnd).getTime();

    assert.ok(startA >= busyEndMs, `Task A start (${startA}) must be >= busy block end (${busyEndMs})`);
  });

  // Test 6 — Working Hours Enforcement
  test("Test 6: Tasks are never scheduled outside allowed working hours (09:00 - 17:00)", () => {
    const taskA = createMockTask("A", 180, 24, []); // 3 hours
    const res = deterministicSchedulerService.scheduleTasks([taskA], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "SUCCESS");
    for (const sub of res.scheduledTasks[0].subtasks) {
      const s = new Date(sub.scheduledStart!);
      const e = new Date(sub.scheduledEnd!);
      assert.ok(s.getHours() >= 9, `Start hour ${s.getHours()} must be >= 9`);
      assert.ok(e.getHours() <= 17, `End hour ${e.getHours()} must be <= 17`);
    }
  });

  // Test 7 — Deadline Preservation
  test("Test 7: Task completes before its specified target deadline", () => {
    const taskA = createMockTask("A", 120, 5, [], "high"); // due in 5 hours
    const res = deterministicSchedulerService.scheduleTasks([taskA], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "SUCCESS");
    const endA = new Date(res.scheduledTasks[0].subtasks[res.scheduledTasks[0].subtasks.length - 1].scheduledEnd!).getTime();
    const deadlineA = new Date(taskA.deadline).getTime();
    assert.ok(endA <= deadlineA, `Completion end (${endA}) must be <= deadline (${deadlineA})`);
  });

  // Test 8 — Hard Deadline Conflict
  test("Test 8: Insufficient capacity for Hard Deadline generates explicit CONFLICT state", () => {
    // Task requires 300 minutes (5 hours) before a deadline in 1 hour
    const taskA = createMockTask("A", 300, 1, [], "high", true); // hard deadline
    const res = deterministicSchedulerService.scheduleTasks([taskA], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "CONFLICT");
    assert.ok(res.conflicts.length > 0);
    assert.strictEqual(res.conflicts[0].type, "HARD_DEADLINE_VIOLATION");
  });

  // Test 9 — Flexible Task Moving
  test("Test 9: Flexible deadline task can project past deadline without aborting schedule", () => {
    const taskFlex = createMockTask("FLEX", 300, 1, [], "medium", false); // flexible deadline
    const res = deterministicSchedulerService.scheduleTasks([taskFlex], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    // Flexible tasks do not generate HARD_DEADLINE_VIOLATION conflict status
    assert.strictEqual(res.status, "SUCCESS");
    assert.ok(res.scheduleInsights.some((i) => i.includes("Flexible commitment")));
  });

  // Test 10 — Overload Detection
  test("Test 10: Overload detected when required effort approaches capacity horizon", () => {
    // 5 tasks of 4 hours each = 20 hours total work
    const tasks = [1, 2, 3, 4, 5].map((i) => createMockTask(`T${i}`, 240, 24, []));
    const res = deterministicSchedulerService.scheduleTasks(tasks, {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "OVERLOAD");
    assert.ok(res.scheduleInsights.some((i) => i.includes("Overload Warning")));
  });

  // Test 11 — 100-Run Determinism Invariant
  test("Test 11: Schedule output is 100% identical across 100 iterations", () => {
    const taskA = createMockTask("A", 60, 12, []);
    const taskB = createMockTask("B", 120, 24, ["A"]);
    const taskC = createMockTask("C", 90, 48, ["B"]);
    const input = [taskC, taskA, taskB];

    const run0 = deterministicSchedulerService.scheduleTasks(input, { now: FIXTURE_NOW });
    const json0 = JSON.stringify(run0);

    for (let i = 0; i < 100; i++) {
      const run = deterministicSchedulerService.scheduleTasks(input, { now: FIXTURE_NOW });
      assert.strictEqual(JSON.stringify(run), json0, `Non-deterministic output on iteration ${i}`);
    }
  });

  // Test 12 — Input Order Independence
  test("Test 12: Shuffling task input array 50 times produces identical schedules", () => {
    const taskA = createMockTask("A", 60, 12, []);
    const taskB = createMockTask("B", 120, 24, ["A"]);
    const taskC = createMockTask("C", 90, 48, ["B"]);
    const taskD = createMockTask("D", 45, 10, []);

    const baseRun = deterministicSchedulerService.scheduleTasks([taskA, taskB, taskC, taskD], { now: FIXTURE_NOW });
    const baseJson = JSON.stringify(baseRun.scheduledTasks);

    for (let i = 0; i < 50; i++) {
      const shuffled = [taskA, taskB, taskC, taskD].sort(() => Math.random() - 0.5);
      const run = deterministicSchedulerService.scheduleTasks(shuffled, { now: FIXTURE_NOW });
      assert.strictEqual(JSON.stringify(run.scheduledTasks), baseJson, `Shuffled run ${i} produced different schedule`);
    }
  });

  // Test 13 — Dependency + Calendar Interplay
  test("Test 13: Task B (depends on A) is scheduled only after A's calendar-shifted end time", () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);

    // Busy block from 09:00 to 11:00 blocks A's first 2 hours
    const res = deterministicSchedulerService.scheduleTasks([taskB, taskA], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals: [{ start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T11:00:00.000Z" }],
    });

    assert.strictEqual(res.status, "SUCCESS");
    const schedA = res.scheduledTasks.find((t) => t.id === "A")!;
    const schedB = res.scheduledTasks.find((t) => t.id === "B")!;

    const startA = new Date(schedA.subtasks[0].scheduledStart!).getTime();
    const endA = new Date(schedA.subtasks[0].scheduledEnd!).getTime();
    const startB = new Date(schedB.subtasks[0].scheduledStart!).getTime();

    assert.ok(startA >= new Date("2026-08-15T11:00:00.000Z").getTime(), "Task A should start at or after 11:00");
    assert.ok(startB >= endA, `Task B start (${startB}) must be >= Task A end (${endA})`);
  });

  // Test 14 — Past Time Protection
  test("Test 14: Scheduler never generates scheduledStart or scheduledEnd before reference 'now'", () => {
    const taskA = createMockTask("A", 60, 24, []);
    const res = deterministicSchedulerService.scheduleTasks([taskA], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.status, "SUCCESS");
    const startA = new Date(res.scheduledTasks[0].subtasks[0].scheduledStart!).getTime();
    const nowMs = new Date(FIXTURE_NOW).getTime();
    assert.ok(startA >= nowMs, `Scheduled start (${startA}) must be >= reference time (${nowMs})`);
  });

  console.log("=================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSchedulerTests();
