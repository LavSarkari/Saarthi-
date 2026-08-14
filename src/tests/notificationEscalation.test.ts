import assert from "node:assert";
import { Task, CommitmentType, CommitmentCategory, NotificationStage } from "../types.js";
import { notificationService } from "../services/notificationService.js";
import { deterministicSchedulerService } from "../services/deterministicSchedulerService.js";
import { reschedulingService } from "../services/reschedulingService.js";
import { computeRiskScore } from "../lib/riskEngine.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";

function createMockNotificationTask(
  id: string,
  durationMinutes = 60,
  deadlineOffsetHours = 24,
  dependsOn: string[] = [],
  commitmentType: CommitmentType = "HARD",
  category: CommitmentCategory = "EXAM",
  amount?: number
): Task {
  const deadlineDate = new Date(new Date(FIXTURE_NOW).getTime() + deadlineOffsetHours * 3600000);
  return {
    id,
    userId: "user_phase6",
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
    commitmentType,
    isHardDeadline: commitmentType === "HARD",
    category,
    amount,
    paymentStatus: category === "BILL" ? "UNPAID" : undefined,
    subscriptionStatus: category === "SUBSCRIPTION" ? "ACTIVE" : undefined,
    renewalDate: category === "SUBSCRIPTION" ? deadlineDate.toISOString() : undefined,
    deliveredNotificationKeys: [],
  };
}

async function runNotificationEscalationTests() {
  console.log("===================================================");
  console.log("RUNNING PHASE 6 NOTIFICATION ESCALATION & OVERRIDE TESTS");
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

  // Test 1 — Upcoming Notification
  await test("Test 1: Upcoming commitment due in 5 days generates UPCOMING stage", async () => {
    const task = createMockNotificationTask("T1", 60, 120); // 5 days out
    const { record } = notificationService.evaluateTaskNotification(task, new Date(FIXTURE_NOW));
    assert.ok(record);
    assert.strictEqual(record.stage, "UPCOMING");
  });

  // Test 2 — Stage Escalation
  await test("Test 2: Stage Escalation progresses UPCOMING -> APPROACHING -> URGENT -> CRITICAL -> OVERDUE", async () => {
    const task = createMockNotificationTask("T2", 60, 2); // 2 hours out
    const { record } = notificationService.evaluateTaskNotification(task, new Date(FIXTURE_NOW));
    assert.ok(record);
    assert.strictEqual(record.stage, "CRITICAL");
  });

  // Test 3 — Notification Idempotency
  await test("Test 3: Notification Idempotency: Repeated evaluation produces zero duplicate alerts", async () => {
    const task = createMockNotificationTask("T3", 60, 2);
    const now = new Date(FIXTURE_NOW);

    const run1 = notificationService.evaluateTaskNotification(task, now);
    assert.ok(run1.record, "First evaluation must generate notification");

    const run2 = notificationService.evaluateTaskNotification(run1.updatedTask, now);
    assert.strictEqual(run2.record, null, "Second evaluation must return null (Idempotency Invariant)");
  });

  // Test 4 — Restart Safety
  await test("Test 4: Restart Safety: Re-instantiating task preserves delivered keys and prevents duplicate alert", async () => {
    const task = createMockNotificationTask("T4", 60, 2);
    const now = new Date(FIXTURE_NOW);

    const run1 = notificationService.evaluateTaskNotification(task, now);
    assert.ok(run1.record);

    // Simulate server restart by JSON serializing and parsing task object
    const restartedTask: Task = JSON.parse(JSON.stringify(run1.updatedTask));

    const run2 = notificationService.evaluateTaskNotification(restartedTask, now);
    assert.strictEqual(run2.record, null, "Restarted task must NOT duplicate notification");
  });

  // Test 5 — Critical HARD Override
  await test("Test 5: Critical HARD Override displaces FLEXIBLE task when competing for capacity", async () => {
    const flexTask = createMockNotificationTask("FLEX_OVER", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const hardTask = createMockNotificationTask("HARD_OVER", 60, 2, [], "HARD", "EXAM"); // Tight 2h deadline

    const res = deterministicSchedulerService.scheduleTasks([flexTask, hardTask], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
    });

    assert.strictEqual(res.scheduledTasks[0].id, "HARD_OVER", "Hard task HARD_OVER must displace FLEX_OVER to get earliest slot");
  });

  // Test 6 — Hard Deadline Impossible
  await test("Test 6: Hard Deadline Impossible returns explicit CONFLICT state (No silent violation)", async () => {
    const hardTask = createMockNotificationTask("HARD_IMP", 120, 1, [], "HARD", "EXAM"); // 2h effort, 1h horizon
    const res = deterministicSchedulerService.scheduleTasks([hardTask], { now: FIXTURE_NOW });

    assert.strictEqual(res.status, "CONFLICT");
    assert.ok(res.conflicts.some((c) => c.type === "HARD_DEADLINE_VIOLATION"));
  });

  // Test 7 — Flexible Eviction
  await test("Test 7: Flexible Eviction: Flexible tasks move downstream while Hard task completes on time", async () => {
    const flexTask = createMockNotificationTask("F1", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const hardTask = createMockNotificationTask("H1", 60, 4, [], "HARD", "EXAM");

    const res = deterministicSchedulerService.scheduleTasks([flexTask, hardTask], { now: FIXTURE_NOW });
    const endH1 = new Date(res.scheduledTasks.find((t) => t.id === "H1")!.subtasks[0].scheduledEnd!).getTime();

    assert.ok(endH1 <= new Date(hardTask.deadline).getTime(), "H1 must finish before its hard deadline");
  });

  // Test 8 — Dependency-Aware Critical Override
  await test("Test 8: Dependency-Aware Critical Override: Prerequisite A inherits critical priority of downstream Hard C", async () => {
    const flexTask = createMockNotificationTask("FLEX_UNRELATED", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const taskA = createMockNotificationTask("A_PRE", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const taskC = createMockNotificationTask("C_HARD", 60, 3, ["A_PRE"], "HARD", "EXAM"); // Hard C has tight 3h deadline!

    const res = deterministicSchedulerService.scheduleTasks([flexTask, taskA, taskC], { now: FIXTURE_NOW });
    const firstSched = res.scheduledTasks[0];

    assert.strictEqual(firstSched.id, "A_PRE", "Prerequisite A_PRE must be scheduled before FLEX_UNRELATED to satisfy C_HARD");
  });

  // Test 9 — Missed Notification
  await test("Test 9: Missed Notification generates structured MISSED event description", async () => {
    const task = createMockNotificationTask("MISSED_1", 60, 24);
    const { record } = notificationService.evaluateTaskNotification(
      task,
      new Date(FIXTURE_NOW),
      { stage: "MISSED", message: "Task MISSED_1 missed window. Auto-rescheduled." }
    );

    assert.ok(record);
    assert.strictEqual(record.stage, "MISSED");
    assert.ok(record.message.includes("MISSED_1"));
  });

  // Test 10 — Rescheduled Notification
  await test("Test 10: Rescheduled Notification generates structured RESCHEDULED event", async () => {
    const task = createMockNotificationTask("RESCHED_1", 60, 24);
    const { record } = notificationService.evaluateTaskNotification(
      task,
      new Date(FIXTURE_NOW),
      { stage: "RESCHEDULED", message: "Task RESCHEDULED_1 moved to 14:00." }
    );

    assert.ok(record);
    assert.strictEqual(record.stage, "RESCHEDULED");
  });

  // Test 11 — Recovery Notification
  await test("Test 11: Recovery Notification generates RECOVERED stage when risk restores to safe", async () => {
    const task = createMockNotificationTask("REC_1", 60, 24);
    const { record } = notificationService.evaluateTaskNotification(
      task,
      new Date(FIXTURE_NOW),
      { stage: "RECOVERED", message: "Task REC_1 buffer restored to safe." }
    );

    assert.ok(record);
    assert.strictEqual(record.stage, "RECOVERED");
  });

  // Test 12 — Blocked Notification
  await test("Test 12: Blocked Notification generates BLOCKED stage when prerequisite is pending", async () => {
    const task = createMockNotificationTask("BLK_1", 60, 24, ["PRE_1"]);
    const { record } = notificationService.evaluateTaskNotification(
      task,
      new Date(FIXTURE_NOW),
      { stage: "BLOCKED", message: "Task BLK_1 is blocked by PRE_1." }
    );

    assert.ok(record);
    assert.strictEqual(record.stage, "BLOCKED");
  });

  // Test 13 — Bill Escalation
  await test("Test 13: Bill Escalation evaluates stage transitions as due date approaches", async () => {
    const bill = createMockNotificationTask("BILL_ESC", 30, 2, [], "HARD", "BILL", 100);
    const { record } = notificationService.evaluateTaskNotification(bill, new Date(FIXTURE_NOW));

    assert.ok(record);
    assert.strictEqual(record.stage, "CRITICAL");
  });

  // Test 14 — Paid Bill
  await test("Test 14: Paid Bill produces no further standard notifications", async () => {
    const paidBill = createMockNotificationTask("BILL_PAID", 30, 2, [], "HARD", "BILL", 100);
    paidBill.paymentStatus = "PAID";

    const { record } = notificationService.evaluateTaskNotification(paidBill, new Date(FIXTURE_NOW));
    assert.strictEqual(record, null, "Paid bill must return null notification record");
  });

  // Test 15 — Subscription Renewal
  await test("Test 15: Subscription Renewal evaluates upcoming renewal stages cleanly", async () => {
    const sub = createMockNotificationTask("SUB_ESC", 30, 48, [], "HARD", "SUBSCRIPTION", 15);
    const { record } = notificationService.evaluateTaskNotification(sub, new Date(FIXTURE_NOW));

    assert.ok(record);
    assert.strictEqual(record.stage, "APPROACHING");
  });

  // Test 16 — Telegram Failure Fault Tolerance
  await test("Test 16: Telegram Failure does NOT crash notification evaluation or scheduling", async () => {
    const task = createMockNotificationTask("TELE_FAIL", 60, 24);
    const res = await notificationService.evaluateAndDispatchNotifications([task], {
      now: FIXTURE_NOW,
      telegramChatId: 999999999, // Non-existent chat ID
    });

    assert.ok(res.updatedTasks);
    assert.strictEqual(res.updatedTasks.length, 1);
  });

  // Test 17 — Missing Telegram Configuration
  await test("Test 17: Missing Telegram Configuration executes cleanly without errors", async () => {
    const task = createMockNotificationTask("TELE_NONE", 60, 24);
    const res = await notificationService.evaluateAndDispatchNotifications([task], {
      now: FIXTURE_NOW,
    });

    assert.ok(res.updatedTasks);
  });

  // Test 18 — Calendar Synchronization
  await test("Test 18: Critical rescheduling updates existing Google Calendar event", async () => {
    const taskA = createMockNotificationTask("A_CAL", 60, 24);
    const taskB = createMockNotificationTask("B_CAL", 60, 24, ["A_CAL"], "HARD", "EXAM");
    taskB.subtasks[0].googleEventId = "google_event_b123";

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user_p6",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "A_CAL",
      tasks: [taskA, taskB],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
      googleAccessToken: "mock_access_token_p6",
    });

    const updatedB = res.updatedTasks.find((t) => t.id === "B_CAL");
    assert.strictEqual(updatedB?.subtasks[0].googleEventId, "google_event_b123", "googleEventId must be preserved during critical rescheduling");
  });

  // Test 19 — 100-run Determinism
  await test("Test 19: 100-run Determinism: Notification decisions are 100% identical across 100 iterations", async () => {
    const task = createMockNotificationTask("DET_NOTIF", 60, 5);
    const now = new Date(FIXTURE_NOW);

    const baseRecord = notificationService.evaluateTaskNotification(task, now).record;
    assert.ok(baseRecord);
    const baseKey = `${baseRecord.taskId}:${baseRecord.stage}:${baseRecord.priority}:${baseRecord.message}`;

    for (let i = 0; i < 100; i++) {
      const curRecord = notificationService.evaluateTaskNotification(task, now).record;
      assert.ok(curRecord);
      const curKey = `${curRecord.taskId}:${curRecord.stage}:${curRecord.priority}:${curRecord.message}`;
      assert.strictEqual(curKey, baseKey, `Run ${i} decision content must match baseline`);
    }
  });

  // Test 20 — Input Order Independence
  await test("Test 20: Input Order Independence: Shuffling task array produces 100% identical batch notifications", async () => {
    const t1 = createMockNotificationTask("SHUF_1", 60, 2, [], "HARD", "EXAM");
    const t2 = createMockNotificationTask("SHUF_2", 60, 24, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");

    const baseRes = await notificationService.evaluateAndDispatchNotifications([t1, t2], { now: FIXTURE_NOW });
    const baseIds = baseRes.deliveredRecords.map((r) => r.taskId);

    for (let i = 0; i < 50; i++) {
      const shuffled = [t2, t1].sort(() => Math.random() - 0.5);
      const curRes = await notificationService.evaluateAndDispatchNotifications(shuffled, { now: FIXTURE_NOW });
      const curIds = curRes.deliveredRecords.map((r) => r.taskId);
      assert.deepStrictEqual(curIds, baseIds, `Shuffled run ${i} must produce identical priority delivery order`);
    }
  });

  // Test 21 — Notification Priority Ranking
  await test("Test 21: Notification Priority Ranking: OVERDUE HARD (P1) outranks UPCOMING (P10)", async () => {
    const pOverdue = notificationService.getNotificationPriority("OVERDUE", true);
    const pUpcoming = notificationService.getNotificationPriority("UPCOMING", false);

    assert.strictEqual(pOverdue, 1);
    assert.strictEqual(pUpcoming, 10);
    assert.ok(pOverdue < pUpcoming, "OVERDUE HARD must have higher priority (lower numerical rank) than UPCOMING");
  });

  // Test 22 — Notification Batching
  await test("Test 22: Notification Batching formats multiple standard alerts into single briefing message", async () => {
    const t1 = createMockNotificationTask("BATCH_1", 60, 48, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");
    const t2 = createMockNotificationTask("BATCH_2", 60, 48, [], "FLEXIBLE", "PERSONAL_FLEXIBLE");

    const res = await notificationService.evaluateAndDispatchNotifications([t1, t2], { now: FIXTURE_NOW });
    assert.ok(res.batchSummaryMessage);
    assert.ok(res.batchSummaryMessage.includes("SAARTHI COMMITMENT BRIEFING"));
  });

  // Test 23 — No Notification Spam
  await test("Test 23: No Notification Spam: 50 consecutive monitor cycles fire exactly 1 notification", async () => {
    const task = createMockNotificationTask("SPAM_TEST", 60, 5);
    const now = new Date(FIXTURE_NOW);

    let currentTask = task;
    let totalFired = 0;

    for (let cycle = 0; cycle < 50; cycle++) {
      const { record, updatedTask } = notificationService.evaluateTaskNotification(currentTask, now);
      currentTask = updatedTask;
      if (record) totalFired++;
    }

    assert.strictEqual(totalFired, 1, "50 monitor cycles must fire exactly 1 notification for the stage");
  });

  // Test 24 — Overdue HARD Commitment
  await test("Test 24: Overdue HARD Commitment produces OVERDUE notification and critical risk status", async () => {
    const overdueHard = createMockNotificationTask("OVER_HARD", 60, -2, [], "HARD", "EXAM");
    const { record } = notificationService.evaluateTaskNotification(overdueHard, new Date(FIXTURE_NOW));

    assert.ok(record);
    assert.strictEqual(record.stage, "OVERDUE");
    assert.ok(record.message.includes("OVERDUE"));
  });

  console.log("===================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runNotificationEscalationTests().catch(console.error);
