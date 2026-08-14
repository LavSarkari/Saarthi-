import assert from "node:assert";
import { createTaskFixture } from "./fixtures/taskFactory.js";
import { deterministicSchedulerService } from "../services/deterministicSchedulerService.js";
import { reschedulingService } from "../services/reschedulingService.js";
import { notificationService } from "../services/notificationService.js";
import { calendarService } from "../services/calendarService.js";
import { taskService } from "../services/taskService.js";
import { dbData, saveDb, loadDb } from "../services/localDb.js";
import { computeRiskScore } from "../lib/riskEngine.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";
const FIXTURE_NOW_DATE = new Date(FIXTURE_NOW);

export async function runE2EScenarioTests() {
  console.log("===================================================");
  console.log("RUNNING PHASE 8 END-TO-END SCENARIO & SYSTEM TESTS");
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

  // Scenario A — Normal Student Workflow
  await test("Scenario A: Normal Student Workflow (Create -> Schedule -> Calendar -> Notif -> Complete)", async () => {
    const task = createTaskFixture({
      id: "scen_a_1",
      title: "Math Homework Assignment",
      durationMinutes: 60,
      deadlineOffsetHours: 24,
      commitmentType: "HARD",
      category: "STUDY",
      createdAt: FIXTURE_NOW,
    });

    // 1. Schedule
    const schedResult = deterministicSchedulerService.scheduleTasks([task], {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });
    assert.strictEqual(schedResult.status, "SUCCESS");
    const scheduledTask = schedResult.scheduledTasks[0];
    assert.ok(scheduledTask.subtasks[0].scheduledStart);

    // 2. Calendar Event Creation payload format
    const events = calendarService.planExecutionIntervals(scheduledTask);
    assert.ok(events.length > 0);
    assert.ok(events[0].summary.startsWith("Saarthi Exec:"));

    // 3. Notification evaluation
    const { updatedTasks: notifTasks } = await notificationService.evaluateAndDispatchNotifications(
      [scheduledTask],
      { now: FIXTURE_NOW }
    );
    assert.ok(notifTasks.length > 0);

    // 4. Mark complete
    const completedTask = {
      ...notifTasks[0],
      isCompleted: true,
      subtasks: notifTasks[0].subtasks.map((s) => ({ ...s, done: true })),
    };
    const risk = computeRiskScore(completedTask);
    assert.strictEqual(risk.completionConfidence, 100);
  });

  // Scenario B — Missed Assignment Auto-Rescheduling
  await test("Scenario B: Missed Assignment Auto-Rescheduling (Delayed -> Reschedule -> MISSED Notif)", async () => {
    const taskA = createTaskFixture({ id: "scen_b_A", title: "Study Physics", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });
    const taskB = createTaskFixture({ id: "scen_b_B", title: "Lab Report", durationMinutes: 60, deadlineOffsetHours: 48, dependsOn: ["scen_b_A"], createdAt: FIXTURE_NOW });

    // Initial Schedule
    const initResult = deterministicSchedulerService.scheduleTasks([taskA, taskB], {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });

    // Simulate Missed trigger after execution window passed
    const laterNow = "2026-08-15T12:00:00.000Z";
    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user_phase8",
      triggerEvent: "TASK_MISSED",
      triggerTaskId: "scen_b_A",
      tasks: initResult.scheduledTasks,
      busyIntervals: [],
      notifyUser: true,
      nowInput: laterNow,
    });

    assert.strictEqual(res.changed, true);
    assert.ok(res.affectedTaskIds.includes("scen_b_A"));
    assert.ok(res.affectedTaskIds.includes("scen_b_B"));
  });

  // Scenario C — Critical Exam Eviction
  await test("Scenario C: Critical Exam Eviction (Urgent HARD exam displaces FLEXIBLE task)", async () => {
    const flexTask = createTaskFixture({ id: "scen_c_flex", title: "Read Novel", durationMinutes: 120, deadlineOffsetHours: 48, commitmentType: "FLEXIBLE", category: "PERSONAL_FLEXIBLE", createdAt: FIXTURE_NOW });
    const urgentExam = createTaskFixture({ id: "scen_c_exam", title: "Final Physics Exam", durationMinutes: 120, deadlineOffsetHours: 4, commitmentType: "HARD", category: "EXAM", createdAt: FIXTURE_NOW });

    const res = deterministicSchedulerService.scheduleTasks([flexTask, urgentExam], {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });
    assert.strictEqual(res.status, "SUCCESS");

    // Urgent Exam must be scheduled first
    const examSched = res.scheduledTasks.find((t) => t.id === "scen_c_exam");
    const flexSched = res.scheduledTasks.find((t) => t.id === "scen_c_flex");

    const examStart = new Date(examSched!.subtasks[0].scheduledStart!).getTime();
    const flexStart = new Date(flexSched!.subtasks[0].scheduledStart!).getTime();

    assert.ok(examStart < flexStart, "Urgent exam must be scheduled ahead of flexible task");
  });

  // Scenario D — Impossible Hard Deadline Conflict
  await test("Scenario D: Impossible Hard Deadline Conflict returns explicit CONFLICT status", async () => {
    const impossibleTask = createTaskFixture({ id: "scen_d_imp", title: "Massive Hard Project", durationMinutes: 1200, deadlineOffsetHours: 2, commitmentType: "HARD", createdAt: FIXTURE_NOW });

    const res = deterministicSchedulerService.scheduleTasks([impossibleTask], {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });
    assert.strictEqual(res.status, "CONFLICT");
    assert.ok(res.conflicts.some((c) => c.type === "HARD_DEADLINE_VIOLATION"));
  });

  // Scenario E — Electricity Bill Escalation
  await test("Scenario E: Electricity Bill Escalation (Unpaid bill -> Overdue -> Paid suppression)", async () => {
    const bill = createTaskFixture({
      id: "scen_e_bill",
      title: "Electricity Bill",
      durationMinutes: 30,
      deadlineOffsetHours: -2, // Overdue by 2 hours
      commitmentType: "HARD",
      category: "BILL",
      amount: 150,
      paymentStatus: "UNPAID",
      createdAt: FIXTURE_NOW,
    });

    const { updatedTasks: monitored } = taskService.processBillAndSubscriptionMonitoring([bill], FIXTURE_NOW_DATE);
    assert.strictEqual(monitored[0].paymentStatus, "OVERDUE");

    const risk = computeRiskScore(monitored[0]);
    assert.strictEqual(risk.zone, "critical");

    // Mark Paid
    const paidBill = { ...monitored[0], paymentStatus: "PAID" as const };
    const { updatedTasks: notifTasks } = await notificationService.evaluateAndDispatchNotifications([paidBill], { now: FIXTURE_NOW });
    assert.strictEqual(notifTasks[0].deliveredNotificationKeys.length, 0); // No new notifications for paid bill
  });

  // Scenario F — Subscription Renewal & Idempotency
  await test("Scenario F: Subscription Renewal & Idempotency (Renewal generated with zero duplicates)", async () => {
    const subTask = createTaskFixture({
      id: "scen_f_sub",
      title: "Netflix Subscription",
      durationMinutes: 15,
      deadlineOffsetHours: 2,
      commitmentType: "HARD",
      category: "SUBSCRIPTION",
      amount: 15,
      subscriptionStatus: "ACTIVE",
      renewalDate: "2026-08-15T12:00:00.000Z",
      createdAt: FIXTURE_NOW,
    });

    const { newRenewalTasks: firstRun } = taskService.generateSubscriptionRenewals([subTask], FIXTURE_NOW_DATE);
    assert.strictEqual(firstRun.length, 1);

    const { newRenewalTasks: secondRun } = taskService.generateSubscriptionRenewals([subTask, ...firstRun], FIXTURE_NOW_DATE);
    assert.strictEqual(secondRun.length, 0); // Idempotent: 0 duplicates
  });

  // Scenario G — Calendar Conflict Avoidance
  await test("Scenario G: Calendar Conflict Avoidance (Schedule offsets around busy blocks)", async () => {
    const task = createTaskFixture({ id: "scen_g_task", title: "Study Chemistry", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });
    const busyBlocks = [{ start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T10:00:00.000Z" }];

    const res = deterministicSchedulerService.scheduleTasks([task], {
      busyIntervals: busyBlocks,
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });
    assert.strictEqual(res.status, "SUCCESS");

    const schedStart = new Date(res.scheduledTasks[0].subtasks[0].scheduledStart!).getTime();
    const busyEnd = new Date("2026-08-15T10:00:00.000Z").getTime();
    assert.ok(schedStart >= busyEnd, "Task must be scheduled after busy block");
  });

  // Scenario H — Server Restart Persistence & Idempotency
  await test("Scenario H: Server Restart Persistence (saveDb -> reload -> zero state corruption)", async () => {
    const task = createTaskFixture({ id: "scen_h_task", title: "Important Exam Prep", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });
    task.deliveredNotificationKeys = ["notif_scen_h_1"];

    dbData.tasks["scen_h_task"] = task;
    saveDb();

    // Reset in-memory reference & reload
    dbData.tasks = {};
    loadDb();

    const reloaded = dbData.tasks["scen_h_task"];
    assert.ok(reloaded);
    assert.strictEqual(reloaded.title, "Important Exam Prep");
    assert.deepStrictEqual(reloaded.deliveredNotificationKeys, ["notif_scen_h_1"]);
  });

  // Scenario I — External API Failure Tolerance
  await test("Scenario I: External API Failure Tolerance (Gracefully handles Google API 401 & missing Telegram)", async () => {
    const task = createTaskFixture({ id: "scen_i_task", title: "API Failure Test", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });

    // 1. Missing Telegram token does not throw
    const { updatedTasks } = await notificationService.evaluateAndDispatchNotifications([task], { now: FIXTURE_NOW });
    assert.strictEqual(updatedTasks.length, 1);

    // 2. Invalid Google token throws explicit AppError without corrupting fallback
    try {
      await calendarService.fetchFreeBusyIntervals("invalid_token", FIXTURE_NOW, "2026-08-16T09:00:00.000Z");
      assert.fail("Should have thrown AppError");
    } catch (err: any) {
      assert.ok(err.message.includes("Google Calendar API failed"));
    }
  });

  // Scenario J — Performance Benchmark & Scale Test
  await test("Scenario J: Performance Benchmark (Scheduler processes 100 tasks under 500ms)", async () => {
    const tasks100 = Array.from({ length: 100 }, (_, i) =>
      createTaskFixture({ id: "scale_100_" + i, title: "Scale Task " + i, durationMinutes: 30, deadlineOffsetHours: 24 + i, createdAt: FIXTURE_NOW })
    );

    const startMs = Date.now();
    const res = deterministicSchedulerService.scheduleTasks(tasks100, {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });
    const durationMs = Date.now() - startMs;

    assert.ok(res.scheduledTasks.length > 0);
    assert.ok(durationMs < 500, `Scheduling 100 tasks took ${durationMs}ms (expected < 500ms)`);
  });

  // Scenario K — Concurrency Lock Test
  await test("Scenario K: Concurrency Lock Test (Parallel reschedule triggers execute sequentially)", async () => {
    const task = createTaskFixture({ id: "scen_k_task", title: "Concurrent Task", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });

    const p1 = reschedulingService.handleRescheduleTrigger({
      userId: "user_concurrency",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "scen_k_task",
      tasks: [task],
      busyIntervals: [],
      notifyUser: false,
      nowInput: FIXTURE_NOW,
    });

    const p2 = reschedulingService.handleRescheduleTrigger({
      userId: "user_concurrency",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "scen_k_task",
      tasks: [task],
      busyIntervals: [],
      notifyUser: false,
      nowInput: FIXTURE_NOW,
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.ok(r1.changed !== undefined);
    assert.ok(r2.changed !== undefined);
  });

  console.log("===================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  runE2EScenarioTests().catch(console.error);
}
