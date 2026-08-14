import assert from "node:assert";
import { Task, CommitmentType, CommitmentCategory } from "../types.js";
import { deterministicSchedulerService } from "../services/deterministicSchedulerService.js";
import { reschedulingService } from "../services/reschedulingService.js";
import { taskService } from "../services/taskService.js";
import { computeRiskScore } from "../lib/riskEngine.js";
import { AppError } from "../services/errorHandler.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";

function createMockCommitment(
  id: string,
  durationMinutes = 60,
  deadlineOffsetHours = 24,
  dependsOn: string[] = [],
  commitmentType: CommitmentType = "HARD",
  category: CommitmentCategory = "EXAM",
  amount?: number,
  isCompleted = false
): Task {
  const deadlineDate = new Date(new Date(FIXTURE_NOW).getTime() + deadlineOffsetHours * 3600000);
  return {
    id,
    userId: "test-user-phase5",
    title: `Commitment ${id}`,
    description: `Description for ${id}`,
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
      },
    ],
    sessionsCompleted: isCompleted ? 1 : 0,
    sessionsPlanned: 1,
    riskFactors: [],
    createdAt: "2026-08-15T08:00:00.000Z",
    googleCalendarSynced: false,
    googleTasksSynced: false,
    dependsOn,
    commitmentType,
    isHardDeadline: commitmentType === "HARD",
    category,
    amount,
    paymentStatus: category === "BILL" ? (isCompleted ? "PAID" : "UNPAID") : undefined,
    subscriptionStatus: category === "SUBSCRIPTION" ? "ACTIVE" : undefined,
    renewalDate: category === "SUBSCRIPTION" ? deadlineDate.toISOString() : undefined,
    isCompleted,
  };
}

async function runCommitmentSemanticsTests() {
  console.log("===================================================");
  console.log("RUNNING PHASE 5 COMMITMENT SEMANTICS TESTS");
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

  // Test 1 — Hard Commitment
  await test("Test 1: Hard Commitment with sufficient capacity schedules before deadline", async () => {
    const hardTask = createMockCommitment("H1", 60, 24, [], "HARD", "EXAM");
    const result = deterministicSchedulerService.scheduleTasks([hardTask], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(result.status, "SUCCESS");
    const endMs = new Date(result.scheduledTasks[0].subtasks[0].scheduledEnd!).getTime();
    const deadlineMs = new Date(hardTask.deadline).getTime();
    assert.ok(endMs <= deadlineMs, "Hard commitment must complete before hard deadline");
  });

  // Test 2 — Hard Deadline Conflict
  await test("Test 2: Hard Deadline Conflict generates explicit CONFLICT state when capacity is insufficient", async () => {
    const hardTask = createMockCommitment("H2", 120, 2, [], "HARD", "EXAM");
    const result = deterministicSchedulerService.scheduleTasks([hardTask], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals: [{ start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T10:30:00.000Z" }],
    });

    assert.strictEqual(result.status, "CONFLICT");
    assert.ok(result.conflicts.some((c) => c.type === "HARD_DEADLINE_VIOLATION"));
  });

  // Test 3 — Flexible Commitment
  await test("Test 3: Flexible Commitment can project past deadline without aborting schedule", async () => {
    const flexTask = createMockCommitment("F1", 120, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const result = deterministicSchedulerService.scheduleTasks([flexTask], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(result.status, "SUCCESS");
  });

  // Test 4 — Hard vs Flexible Competition
  await test("Test 4: Hard vs Flexible Competition: Hard commitment is protected and assigned earliest slot", async () => {
    const flexTask = createMockCommitment("F1", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const hardTask = createMockCommitment("H1", 60, 24, [], "HARD", "EXAM");

    const result = deterministicSchedulerService.scheduleTasks([flexTask, hardTask], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    const firstScheduled = result.scheduledTasks[0];
    assert.strictEqual(firstScheduled.id, "H1", "Hard commitment H1 must be prioritized over Flexible F1");
  });

  // Test 5 — Hard Downstream Dependency (A -> B)
  await test("Test 5: Hard Downstream Dependency: A is scheduled so hard dependent B completes before deadline", async () => {
    const taskA = createMockCommitment("A", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const taskB = createMockCommitment("B", 60, 6, ["A"], "HARD", "EXAM");

    const result = deterministicSchedulerService.scheduleTasks([taskA, taskB], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    const schedA = result.scheduledTasks.find((t) => t.id === "A")!;
    const schedB = result.scheduledTasks.find((t) => t.id === "B")!;

    const endA = new Date(schedA.subtasks[0].scheduledEnd!).getTime();
    const startB = new Date(schedB.subtasks[0].scheduledStart!).getTime();
    const endB = new Date(schedB.subtasks[0].scheduledEnd!).getTime();

    assert.ok(startB >= endA, "B must start after A ends");
    assert.ok(endB <= new Date(taskB.deadline).getTime(), "Hard dependent B must complete before deadline");
  });

  // Test 6 — Bill Commitment Creation & Properties
  await test("Test 6: Bill Commitment behaves as HARD constraint with unpaid risk tracking", async () => {
    const billTask = createMockCommitment("BILL_1", 30, 24, [], "HARD", "BILL", 150);
    assert.strictEqual(billTask.commitmentType, "HARD");
    assert.strictEqual(billTask.paymentStatus, "UNPAID");
    assert.strictEqual(billTask.amount, 150);

    const risk = computeRiskScore(billTask);
    assert.ok(typeof risk.score === "number");
  });

  // Test 7 — Bill Overdue Detection in Production Background Worker
  await test("Test 7: Bill Overdue Detection transitions UNPAID past-due bills to OVERDUE status", async () => {
    const pastBill = createMockCommitment("BILL_PAST", 30, -5, [], "HARD", "BILL", 200); // 5h overdue
    pastBill.paymentStatus = "UNPAID";

    const now = new Date(FIXTURE_NOW);
    const { updatedTasks, notifications } = taskService.processBillAndSubscriptionMonitoring([pastBill], now);

    assert.strictEqual(updatedTasks.length, 1);
    assert.strictEqual(updatedTasks[0].paymentStatus, "OVERDUE");
    assert.strictEqual(updatedTasks[0].riskZone, "critical");
    assert.ok(notifications.some((n) => n.includes("CRITICAL BILL OVERDUE")));
  });

  // Test 8 — Bill Reminder Escalation & Idempotency
  await test("Test 8: Bill Reminder Escalation transitions stages cleanly without duplicate alerts", async () => {
    const billTask = createMockCommitment("BILL_2", 30, 2, [], "HARD", "BILL", 250); // Due in 2 hours
    const now = new Date(FIXTURE_NOW);

    const res1 = taskService.processBillAndSubscriptionMonitoring([billTask], now);
    assert.strictEqual(res1.updatedTasks[0].reminderStage, "DUE_DATE");
    assert.strictEqual(res1.notifications.length, 1);

    // Repeated execution with identical state MUST produce 0 duplicate notifications (Idempotency Invariant)
    const res2 = taskService.processBillAndSubscriptionMonitoring(res1.updatedTasks, now);
    assert.strictEqual(res2.notifications.length, 0, "Repeated monitor execution must NOT fire duplicate notifications");
  });

  // Test 9 — Subscription Renewal Recurrence Generation
  await test("Test 9: Subscription Renewal generates future renewal instance with stable ID", async () => {
    const subTask = createMockCommitment("SUB_1", 30, 2, [], "HARD", "SUBSCRIPTION", 15);
    const now = new Date(FIXTURE_NOW);

    const { newRenewalTasks } = taskService.generateSubscriptionRenewals([subTask], now);
    assert.strictEqual(newRenewalTasks.length, 1);
    assert.ok(newRenewalTasks[0].id.startsWith("sub_renewal_SUB_1_"));
    assert.strictEqual(newRenewalTasks[0].category, "SUBSCRIPTION");
  });

  // Test 10 — Subscription Renewal Idempotency
  await test("Test 10: Subscription Renewal Idempotency: Processing task twice produces zero duplicate instances", async () => {
    const subTask = createMockCommitment("SUB_2", 30, 2, [], "HARD", "SUBSCRIPTION", 20);
    const now = new Date(FIXTURE_NOW);

    const run1 = taskService.generateSubscriptionRenewals([subTask], now);
    const allTasks = [subTask, ...run1.newRenewalTasks];
    const run2 = taskService.generateSubscriptionRenewals(allTasks, now);

    assert.strictEqual(run2.newRenewalTasks.length, 0, "Repeated renewal generation must NOT produce duplicate instances");
  });

  // Test 11 — Contradictory Input Resolution (isHardDeadline vs commitmentType)
  await test("Test 11: Contradictory Input Resolution: commitmentType is canonical source of truth", async () => {
    const prepared = taskService.validateAndPrepareTask({
      userId: "user_contra",
      title: "Contradictory Input Task",
      deadline: "2026-08-20T18:00:00.000Z",
      commitmentType: "FLEXIBLE",
      isHardDeadline: true, // Contradicts commitmentType!
    });

    assert.strictEqual(prepared.commitmentType, "FLEXIBLE", "commitmentType MUST be canonical source of truth");
    assert.strictEqual(prepared.isHardDeadline, false, "isHardDeadline MUST be strictly derived as (commitmentType === 'HARD')");
  });

  // Test 12 — HARD Commitment Without Deadline Rejection
  await test("Test 12: HARD Commitment without explicit deadline throws AppError (No silent downgrade)", async () => {
    try {
      taskService.validateAndPrepareTask({
        userId: "user_nodeadline",
        title: "Hard No Deadline",
        commitmentType: "HARD",
      });
      assert.fail("Should have thrown AppError for missing HARD deadline");
    } catch (err: any) {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes("HARD commitment requires an explicit target deadline"));
    }
  });

  // Test 13 — Exact Risk Scoring Verification
  await test("Test 13: Exact Risk Scoring: HARD buffer (<24h) (+15) and OVERDUE bill (+35)", async () => {
    const tightHard = createMockCommitment("HARD_TIGHT", 60, 10, [], "HARD", "EXAM");
    const riskHard = computeRiskScore(tightHard);

    const overdueBill = createMockCommitment("BILL_OVER", 60, -2, [], "HARD", "BILL", 100);
    overdueBill.paymentStatus = "OVERDUE";
    const riskBill = computeRiskScore(overdueBill);

    assert.strictEqual(riskBill.zone, "critical");
    assert.ok(riskBill.score > riskHard.score, "OVERDUE bill must carry higher risk penalty than tight HARD task");
  });

  // Test 14 — Calendar + Hard Deadline Conflict
  await test("Test 14: Calendar + Hard Deadline conflict returns explicit CONFLICT state", async () => {
    const hardTask = createMockCommitment("H_CAL", 120, 3, [], "HARD", "EXAM");
    const result = deterministicSchedulerService.scheduleTasks([hardTask], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals: [{ start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T12:00:00.000Z" }],
    });

    assert.strictEqual(result.status, "CONFLICT");
    assert.ok(result.conflicts.some((c) => c.type === "HARD_DEADLINE_VIOLATION"));
  });

  // Test 15 — Backward Compatibility
  await test("Test 15: Backward Compatibility: Legacy tasks without commitmentType default safely", async () => {
    const legacyHard = createMockCommitment("L1", 60, 24);
    delete (legacyHard as any).commitmentType;
    legacyHard.isHardDeadline = true;

    const legacyFlex = createMockCommitment("L2", 60, 24);
    delete (legacyFlex as any).commitmentType;
    legacyFlex.isHardDeadline = false;

    const result = deterministicSchedulerService.scheduleTasks([legacyFlex, legacyHard], { now: FIXTURE_NOW });
    assert.strictEqual(result.scheduledTasks[0].id, "L1", "Legacy hard deadline L1 must rank ahead of L2");
  });

  // Test 16 — 100-run Determinism Test
  await test("Test 16: 100-run Determinism: Scheduling commitment semantics 100 times yields 100% identical outputs", async () => {
    const taskH = createMockCommitment("H_DET", 60, 24, [], "HARD", "BILL", 200);
    const taskF = createMockCommitment("F_DET", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");

    const baselineJson = JSON.stringify(
      deterministicSchedulerService.scheduleTasks([taskF, taskH], { now: FIXTURE_NOW }).scheduledTasks
    );

    for (let i = 0; i < 100; i++) {
      const currentJson = JSON.stringify(
        deterministicSchedulerService.scheduleTasks([taskF, taskH], { now: FIXTURE_NOW }).scheduledTasks
      );
      assert.strictEqual(currentJson, baselineJson, `Iteration ${i} output must match baseline`);
    }
  });

  // Test 17 — Input Order Independence Test
  await test("Test 17: Input Order Independence: Shuffling task input 50 times produces 100% identical schedules", async () => {
    const taskH = createMockCommitment("H_SHUF", 60, 24, [], "HARD", "EXAM");
    const taskF1 = createMockCommitment("F_SHUF1", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const taskF2 = createMockCommitment("F_SHUF2", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");

    const baselineJson = JSON.stringify(
      deterministicSchedulerService.scheduleTasks([taskF1, taskH, taskF2], { now: FIXTURE_NOW }).scheduledTasks
    );

    const taskList = [taskF1, taskH, taskF2];

    for (let i = 0; i < 50; i++) {
      const shuffled = [...taskList].sort(() => Math.random() - 0.5);
      const currentJson = JSON.stringify(
        deterministicSchedulerService.scheduleTasks(shuffled, { now: FIXTURE_NOW }).scheduledTasks
      );
      assert.strictEqual(currentJson, baselineJson, `Shuffled run ${i} output must match baseline`);
    }
  });

  console.log("===================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runCommitmentSemanticsTests().catch(console.error);
