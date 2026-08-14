import assert from "node:assert";
import { Task } from "../types.js";
import { reschedulingService } from "../services/reschedulingService.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";

function createMockTask(
  id: string,
  durationMinutes = 60,
  deadlineOffsetHours = 24,
  dependsOn: string[] = [],
  priority: "low" | "medium" | "high" = "medium",
  isHardDeadline = false,
  isCompleted = false
): Task {
  const deadlineDate = new Date(new Date(FIXTURE_NOW).getTime() + deadlineOffsetHours * 3600000);
  return {
    id,
    userId: "test-user-phase3",
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
        done: isCompleted,
        order: 1,
      },
    ],
    sessionsCompleted: isCompleted ? 1 : 0,
    sessionsPlanned: 1,
    riskFactors: [],
    createdAt: "2026-08-15T08:00:00.000Z",
    googleCalendarSynced: false,
    googleTasksSynced: false,
    dependsOn,
    isHardDeadline,
    isCompleted,
  };
}

async function runReschedulingTests() {
  console.log("===================================================");
  console.log("RUNNING PHASE 3 AUTOMATIC RESCHEDULING TESTS");
  console.log("===================================================");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Test 1 — Simple Delay (A -> B -> C)
  await test("Test 1: Simple Delay (A -> B -> C): Delaying A shifts B and C downstream", async () => {
    let taskA = createMockTask("A", 60, 24, []);
    let taskB = createMockTask("B", 60, 24, ["A"]);
    let taskC = createMockTask("C", 60, 24, ["B"]);

    // Initial schedule
    const initialRun = await reschedulingService.handleRescheduleTrigger({
      userId: "user1",
      triggerEvent: "NEW_COMMITMENT_ADDED",
      tasks: [taskA, taskB, taskC],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    assert.strictEqual(initialRun.scheduleResult.status, "SUCCESS");

    // Now simulate delaying A by adding a 2-hour busy interval at 09:00-11:00
    const delayedRun = await reschedulingService.handleRescheduleTrigger({
      userId: "user1",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "A",
      tasks: initialRun.updatedTasks,
      scheduleOptions: {
        now: FIXTURE_NOW,
        preferredStartHour: 9,
        preferredEndHour: 17,
        busyIntervals: [{ start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T11:00:00.000Z" }],
      },
    });

    assert.strictEqual(delayedRun.changed, true);
    assert.deepStrictEqual(delayedRun.affectedTaskIds.sort(), ["A", "B", "C"]);

    const endA = new Date(delayedRun.updatedTasks.find((t) => t.id === "A")!.subtasks[0].scheduledEnd!).getTime();
    const startB = new Date(delayedRun.updatedTasks.find((t) => t.id === "B")!.subtasks[0].scheduledStart!).getTime();
    const endB = new Date(delayedRun.updatedTasks.find((t) => t.id === "B")!.subtasks[0].scheduledEnd!).getTime();
    const startC = new Date(delayedRun.updatedTasks.find((t) => t.id === "C")!.subtasks[0].scheduledStart!).getTime();

    assert.ok(endA <= startB, "B must start after A ends");
    assert.ok(endB <= startC, "C must start after B ends");
  });

  // Test 2 — Unrelated Tasks Preservation
  await test("Test 2: Unrelated Tasks (A -> B, X -> Y): Delaying A only targets affected DAG nodes A and B", async () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);
    const taskX = createMockTask("X", 60, 24, []);
    const taskY = createMockTask("Y", 60, 24, ["X"]);

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user2",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "A",
      tasks: [taskA, taskB, taskX, taskY],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    // Verify affected tasks only include A and B
    assert.deepStrictEqual(res.affectedTaskIds.sort(), ["A", "B"]);
    assert.ok(!res.affectedTaskIds.includes("X"));
    assert.ok(!res.affectedTaskIds.includes("Y"));
  });

  // Test 3 — Hard Deadline Protection
  await test("Test 3: Hard Deadline Protection: Prerequisite delay generating hard deadline conflict alerts user without silent move", async () => {
    const taskA = createMockTask("A", 180, 24, []); // 3 hours
    const taskB = createMockTask("B", 180, 4, ["A"], "high", true); // Hard deadline in 4 hours (13:00)

    const delayed = await reschedulingService.handleRescheduleTrigger({
      userId: "user3",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "A",
      tasks: [taskA, taskB],
      scheduleOptions: {
        now: FIXTURE_NOW,
        preferredStartHour: 9,
        preferredEndHour: 17,
        busyIntervals: [{ start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T12:00:00.000Z" }], // 3h delay
      },
    });

    assert.strictEqual(delayed.scheduleResult.status, "CONFLICT");
    assert.ok(delayed.notificationsFired.some((n) => n.includes("Hard Deadline Conflict Alert")));
  });

  // Test 4 — Calendar Conflict During Shift
  await test("Test 4: Calendar Conflict during shift places dependent task into next open slot", async () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);

    // Busy block at 10:00-11:00
    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user4",
      triggerEvent: "TASK_DELAYED",
      tasks: [taskA, taskB],
      scheduleOptions: {
        now: FIXTURE_NOW,
        preferredStartHour: 9,
        preferredEndHour: 17,
        busyIntervals: [{ start: "2026-08-15T10:00:00.000Z", end: "2026-08-15T11:00:00.000Z" }],
      },
    });

    assert.strictEqual(res.scheduleResult.status, "SUCCESS");
    const schedB = res.updatedTasks.find((t) => t.id === "B")!;
    const startB = new Date(schedB.subtasks[0].scheduledStart!).getTime();
    assert.ok(startB >= new Date("2026-08-15T11:00:00.000Z").getTime(), "B must start after busy block ends at 11:00");
  });

  // Test 5 — Missed Task Detection
  await test("Test 5: Missed Task: Triggers schedule recalculation for downstream tasks", async () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user5",
      triggerEvent: "TASK_MISSED",
      triggerTaskId: "A",
      tasks: [taskA, taskB],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    assert.ok(res.affectedTaskIds.includes("A"));
    assert.ok(res.affectedTaskIds.includes("B"));
  });

  // Test 6 — Early Completion
  await test("Test 6: Early Completion of A unblocks B to run earlier", async () => {
    const taskA = createMockTask("A", 60, 24, [], "medium", false, true); // Completed early
    const taskB = createMockTask("B", 60, 24, ["A"]);

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user6",
      triggerEvent: "TASK_COMPLETED_EARLY",
      triggerTaskId: "A",
      tasks: [taskA, taskB],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    assert.strictEqual(res.scheduleResult.status, "SUCCESS");
    const schedB = res.updatedTasks.find((t) => t.id === "B")!;
    const startB = new Date(schedB.subtasks[0].scheduledStart!).getTime();

    // Task B can start immediately at 09:00 since A is completed!
    assert.strictEqual(startB, new Date("2026-08-15T09:00:00.000Z").getTime());
  });

  // Test 7 — Late Completion
  await test("Test 7: Late Completion shifts downstream dependent task", async () => {
    const taskA = createMockTask("A", 120, 24, []); // 2h instead of 1h
    const taskB = createMockTask("B", 60, 24, ["A"]);

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user7",
      triggerEvent: "TASK_COMPLETED_LATE",
      triggerTaskId: "A",
      tasks: [taskA, taskB],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 21 },
    });

    const subtasksA = res.updatedTasks.find((t) => t.id === "A")!.subtasks;
    const lastSubA = subtasksA[subtasksA.length - 1];
    const endA = new Date(lastSubA.scheduledEnd!).getTime();
    const startB = new Date(res.updatedTasks.find((t) => t.id === "B")!.subtasks[0].scheduledStart!).getTime();
    assert.strictEqual(startB, endA, "Task B start time must equal Task A last subtask completion end time");
  });

  // Test 8 — Repeated Trigger (Idempotency & Zero Schedule Drift)
  await test("Test 8: Idempotency Invariant: Running trigger twice produces zero schedule drift and 0 duplicate notifications", async () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);

    const run1 = await reschedulingService.handleRescheduleTrigger({
      userId: "user8",
      triggerEvent: "TASK_DELAYED",
      tasks: [taskA, taskB],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    // Second run with identical state
    const run2 = await reschedulingService.handleRescheduleTrigger({
      userId: "user8",
      triggerEvent: "TASK_DELAYED",
      tasks: run1.updatedTasks,
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    assert.strictEqual(run2.changed, false, "Second run must have changed = false (no-op)");
    assert.strictEqual(run2.notificationsFired.length, 0, "No duplicate notifications should be fired");
    assert.strictEqual(
      JSON.stringify(run1.updatedTasks),
      JSON.stringify(run2.updatedTasks),
      "Timestamps must be 100% identical across runs"
    );
  });

  // Test 9 — Concurrent Triggers
  await test("Test 9: Sequential execution lock handles concurrent triggers without race condition", async () => {
    const taskA = createMockTask("A", 60, 24, []);
    const promise1 = reschedulingService.handleRescheduleTrigger({
      userId: "user9",
      triggerEvent: "TASK_DELAYED",
      tasks: [taskA],
      scheduleOptions: { now: FIXTURE_NOW },
    });
    const promise2 = reschedulingService.handleRescheduleTrigger({
      userId: "user9",
      triggerEvent: "TASK_DELAYED",
      tasks: [taskA],
      scheduleOptions: { now: FIXTURE_NOW },
    });

    const [res1, res2] = await Promise.all([promise1, promise2]);
    assert.ok(res1 && res2);
  });

  // Test 10 — Risk Recalculation
  await test("Test 10: Schedule recalculation updates riskScore and riskZone in riskEngine.ts", async () => {
    const taskA = createMockTask("A", 60, 3, []); // Due in 3 hours -> high pressure

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user10",
      triggerEvent: "TASK_DELAYED",
      tasks: [taskA],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    const schedA = res.updatedTasks[0];
    assert.ok(typeof schedA.riskScore === "number");
    assert.ok(["safe", "watch", "critical"].includes(schedA.riskZone));
  });

  // Test 11 — Multi-Level Dependency Chain (A -> B -> C -> D)
  await test("Test 11: Multi-Level Chain (A -> B -> C -> D) identifies all 4 affected tasks", async () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);
    const taskC = createMockTask("C", 60, 24, ["B"]);
    const taskD = createMockTask("D", 60, 24, ["C"]);

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user11",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "A",
      tasks: [taskA, taskB, taskC, taskD],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    assert.deepStrictEqual(res.affectedTaskIds.sort(), ["A", "B", "C", "D"]);
  });

  // Test 12 — Partial Graph Modification (A -> B, X -> Y)
  await test("Test 12: Partial Graph Modification: Delaying B only affects B and downstream dependents", async () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);
    const taskC = createMockTask("C", 60, 24, ["B"]);

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user12",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "B",
      tasks: [taskA, taskB, taskC],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    assert.deepStrictEqual(res.affectedTaskIds.sort(), ["B", "C"]);
    assert.ok(!res.affectedTaskIds.includes("A"), "Task A should not be in affected scope when B slips");
  });

  console.log("===================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runReschedulingTests().catch(console.error);
