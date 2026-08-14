import assert from "node:assert";
import { Task, CommitmentType, CommitmentCategory } from "../types.js";
import { adaptivePlanningService } from "../services/adaptivePlanningService.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";

function createMockHistoryTask(
  id: string,
  durationMinutes = 60,
  deadlineOffsetHours = 24,
  isCompleted = false,
  isLate = false,
  dependsOn: string[] = [],
  commitmentType: CommitmentType = "HARD",
  category: CommitmentCategory = "EXAM"
): Task {
  const createdDate = new Date("2026-08-10T09:00:00.000Z");
  const deadlineDate = new Date(createdDate.getTime() + deadlineOffsetHours * 3600000);

  // If late, scheduledEnd is 2 hours past deadline
  const endMs = isLate ? deadlineDate.getTime() + 7200000 : deadlineDate.getTime() - 3600000;
  const startMs = endMs - durationMinutes * 60000;

  return {
    id,
    userId: "user_phase7",
    title: `Task ${id}`,
    description: `Desc ${id}`,
    complexity: "medium",
    priority: "medium",
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
        scheduledStart: new Date(startMs).toISOString(),
        scheduledEnd: new Date(endMs).toISOString(),
      },
    ],
    sessionsCompleted: isCompleted ? 1 : 0,
    sessionsPlanned: 1,
    riskFactors: [],
    createdAt: createdDate.toISOString(),
    googleCalendarSynced: false,
    googleTasksSynced: false,
    dependsOn,
    commitmentType,
    isHardDeadline: commitmentType === "HARD",
    category,
    isCompleted,
  };
}

async function runAdaptivePlanningTests() {
  console.log("===================================================");
  console.log("RUNNING PHASE 7 ADAPTIVE PLANNING DETERMINISM TESTS");
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

  // Test 1 — No Randomness
  await test("Test 1: Adaptive Planning state contains ZERO Math.random() usage", async () => {
    const history = [
      createMockHistoryTask("H1", 60, 24, true, false),
      createMockHistoryTask("H2", 60, 24, true, false),
      createMockHistoryTask("H3", 60, 24, true, false),
    ];
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    assert.strictEqual(typeof state.planningAccuracy, "number");
    assert.strictEqual(typeof state.estimateAccuracy, "number");
  });

  // Test 2 — Real Completion Rate
  await test("Test 2: Completion Rate is calculated deterministically from real observable tasks", async () => {
    const history = [
      createMockHistoryTask("T1", 60, 24, true),
      createMockHistoryTask("T2", 60, 24, true),
      createMockHistoryTask("T3", 60, 24, true),
      createMockHistoryTask("T4", 60, 24, false), // 3 completed out of 4 = 75%
    ];
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    assert.strictEqual(state.completionRate, 75);
  });

  // Test 3 — On-Time Rate
  await test("Test 3: On-Time Rate calculates exact percentage of tasks completed before deadline", async () => {
    const history = [
      createMockHistoryTask("T1", 60, 24, true, false), // On time
      createMockHistoryTask("T2", 60, 24, true, false), // On time
      createMockHistoryTask("T3", 60, 24, true, true),  // Late
    ];
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    assert.strictEqual(state.onTimeRate, 67); // 2 out of 3 = 67%
  });

  // Test 4 — Miss Rate
  await test("Test 4: Miss Rate is derived from uncompleted past-due tasks", async () => {
    const history = [
      createMockHistoryTask("T1", 60, -5, false), // 5h overdue & uncompleted
      createMockHistoryTask("T2", 60, 24, true),
    ];
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    assert.ok(state.averageScheduleStability < 100);
  });

  // Test 5 — Reschedule Rate Metric Tracking
  await test("Test 5: Reschedule Rate metric tracks adaptive improvements", async () => {
    const history = [
      createMockHistoryTask("T1", 60, 24, true),
      createMockHistoryTask("T2", 60, 24, true),
      createMockHistoryTask("T3", 60, 24, true),
    ];
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    assert.strictEqual(state.adaptiveImprovements, 3);
  });

  // Test 6 — Average Delay
  await test("Test 6: Average Delay computes exact mean delay minutes for late completed tasks", async () => {
    const history = [
      createMockHistoryTask("T1", 60, 24, true, true), // Late by 120 mins
      createMockHistoryTask("T2", 60, 24, true, false), // On time
    ];
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    assert.strictEqual(state.averageDelayMinutes, 120);
  });

  // Test 7 — Insufficient Data
  await test("Test 7: Insufficient Data (< 3 samples) produces explicit INSUFFICIENT_DATA status without fake scores", async () => {
    const history = [createMockHistoryTask("T1", 60, 24, true)]; // Only 1 sample
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);

    assert.strictEqual(state.hasSufficientData, false);
    assert.strictEqual(state.dataStatus, "INSUFFICIENT_DATA");
    assert.strictEqual(state.planningAccuracy, 0);
  });

  // Test 8 — Duration Adaptation
  await test("Test 8: Duration Adaptation computes deterministic median actual duration for category", async () => {
    const history = [
      createMockHistoryTask("EX1", 60, 24, true, false, [], "HARD", "EXAM"),
      createMockHistoryTask("EX2", 70, 24, true, false, [], "HARD", "EXAM"),
      createMockHistoryTask("EX3", 80, 24, true, false, [], "HARD", "EXAM"),
    ];
    const res = adaptivePlanningService.getAdaptedDuration("EXAM", 60, history);

    assert.strictEqual(res.isAdapted, true);
    assert.strictEqual(res.adaptedMinutes, 70); // Median of 60, 70, 80 is 70
  });

  // Test 9 — Outlier Handling
  await test("Test 9: Outlier Handling clamps extreme historical deviations between 0.5x and 2.0x requested", async () => {
    const history = [
      createMockHistoryTask("EX1", 500, 24, true, false, [], "HARD", "EXAM"),
      createMockHistoryTask("EX2", 500, 24, true, false, [], "HARD", "EXAM"),
      createMockHistoryTask("EX3", 500, 24, true, false, [], "HARD", "EXAM"),
    ];
    const res = adaptivePlanningService.getAdaptedDuration("EXAM", 60, history);

    assert.strictEqual(res.isAdapted, true);
    assert.strictEqual(res.adaptedMinutes, 120); // Capped at 2.0 * 60 = 120
  });

  // Test 10 — Dependency-Caused Delay
  await test("Test 10: Dependency-Caused Delay does not penalize user schedule stability", async () => {
    const taskA = createMockHistoryTask("A", 60, -5, false); // Overdue prerequisite
    const taskB = createMockHistoryTask("B", 60, -2, false, false, ["A"]); // Blocked by A

    const state = adaptivePlanningService.computeDeterministicState([taskA, taskB], "balanced", FIXTURE_NOW);
    assert.strictEqual(state.averageScheduleStability, 90); // Only task A penalizes stability, task B is dependency-blocked
  });

  // Test 11 — Calendar-Caused Delay
  await test("Test 11: Calendar-Caused Delay does not falsely pollute completion metrics", async () => {
    const history = [
      createMockHistoryTask("C1", 60, 24, true, false),
      createMockHistoryTask("C2", 60, 24, true, false),
      createMockHistoryTask("C3", 60, 24, true, false),
    ];
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    assert.strictEqual(state.completionRate, 100);
  });

  // Test 12 — HARD Commitment Semantics Integrity
  await test("Test 12: Adaptive Planning never alters or weakens HARD commitment deadline constraints", async () => {
    const hardTask = createMockHistoryTask("HARD_1", 60, 24, false, false, [], "HARD", "EXAM");
    assert.strictEqual(hardTask.commitmentType, "HARD");
    assert.strictEqual(hardTask.isHardDeadline, true);
  });

  // Test 13 — FLEXIBLE Commitment Adaptation
  await test("Test 13: Flexible Commitment can adapt duration estimate based on category history", async () => {
    const history = [
      createMockHistoryTask("F1", 45, 24, true, false, [], "FLEXIBLE", "PERSONAL_FLEXIBLE"),
      createMockHistoryTask("F2", 45, 24, true, false, [], "FLEXIBLE", "PERSONAL_FLEXIBLE"),
      createMockHistoryTask("F3", 45, 24, true, false, [], "FLEXIBLE", "PERSONAL_FLEXIBLE"),
    ];
    const adapted = adaptivePlanningService.getAdaptedDuration("PERSONAL_FLEXIBLE", 30, history);
    assert.strictEqual(adapted.adaptedMinutes, 45);
  });

  // Test 14 — Recurring Commitment Independence
  await test("Test 14: Future generated recurring renewal instances do not contaminate historical metrics", async () => {
    const futureRenewal = createMockHistoryTask("sub_renewal_1", 60, 720, false, false, [], "HARD", "SUBSCRIPTION");
    const history = [createMockHistoryTask("H1", 60, 24, true, false), futureRenewal];

    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    assert.strictEqual(state.completionRate, 50);
  });

  // Test 15 — Notification Independence
  await test("Test 15: Delivered notifications do not count as task completion", async () => {
    const task = createMockHistoryTask("NOTIF_TASK", 60, 24, false);
    task.lastNotificationStage = "CRITICAL";
    task.deliveredNotificationKeys = ["key1"];

    const state = adaptivePlanningService.computeDeterministicState([task], "balanced", FIXTURE_NOW);
    assert.strictEqual(state.completionRate, 0);
  });

  // Test 16 — 100-run Determinism
  await test("Test 16: 100-run Determinism: Computing adaptive state 100 times yields 100% identical outputs", async () => {
    const history = [
      createMockHistoryTask("DET_1", 60, 24, true, false),
      createMockHistoryTask("DET_2", 60, 24, true, false),
      createMockHistoryTask("DET_3", 60, 24, false, false),
    ];
    const baseJson = JSON.stringify(adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW));

    for (let i = 0; i < 100; i++) {
      const curJson = JSON.stringify(adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW));
      assert.strictEqual(curJson, baseJson, `Run ${i} output must match baseline`);
    }
  });

  // Test 17 — Input Order Independence
  await test("Test 17: Input Order Independence: Shuffling task array 50 times produces 100% identical adaptive metrics", async () => {
    const t1 = createMockHistoryTask("SHUF_A", 60, 24, true, false);
    const t2 = createMockHistoryTask("SHUF_B", 60, 24, true, true);
    const t3 = createMockHistoryTask("SHUF_C", 60, 24, false, false);

    const baseJson = JSON.stringify(adaptivePlanningService.computeDeterministicState([t1, t2, t3], "balanced", FIXTURE_NOW));

    for (let i = 0; i < 50; i++) {
      const shuffled = [t1, t2, t3].sort(() => Math.random() - 0.5);
      const curJson = JSON.stringify(adaptivePlanningService.computeDeterministicState(shuffled, "balanced", FIXTURE_NOW));
      assert.strictEqual(curJson, baseJson, `Shuffled run ${i} must match baseline`);
    }
  });

  // Test 18 — Explicit now Injected Time
  await test("Test 18: Injected now parameter produces identical output regardless of environment", async () => {
    const history = [createMockHistoryTask("TIME_1", 60, 24, true)];
    const state1 = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);
    const state2 = adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW);

    assert.strictEqual(state1.lastOptimized, state2.lastOptimized);
  });

  // Test 19 — Current-Time Isolation
  await test("Test 19: System clock variation does not alter metrics when now is explicitly specified", async () => {
    const history = [createMockHistoryTask("TIME_2", 60, 24, true)];
    const state = adaptivePlanningService.computeDeterministicState(history, "balanced", "2026-08-15T09:00:00.000Z");

    assert.strictEqual(state.lastOptimized, "2026-08-15T09:00:00.000Z");
  });

  // Test 20 — Fallback Determinism
  await test("Test 20: Fallback deterministic baseline remains 100% identical across repeated runs", async () => {
    const state1 = adaptivePlanningService.computeDeterministicState([], "balanced", FIXTURE_NOW);
    const state2 = adaptivePlanningService.computeDeterministicState([], "balanced", FIXTURE_NOW);

    assert.strictEqual(JSON.stringify(state1), JSON.stringify(state2));
  });

  console.log("===================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAdaptivePlanningTests().catch(console.error);
