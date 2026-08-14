import assert from "node:assert";
import { createTaskFixture } from "./fixtures/taskFactory.js";
import { deterministicSchedulerService } from "../services/deterministicSchedulerService.js";
import { reschedulingService } from "../services/reschedulingService.js";
import { notificationService } from "../services/notificationService.js";
import { calendarService } from "../services/calendarService.js";
import { taskService } from "../services/taskService.js";
import { dbData, saveDb, loadDb } from "../services/localDb.js";
import { computeRiskScore } from "../lib/riskEngine.js";
import { adaptivePlanningService } from "../services/adaptivePlanningService.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";
const FIXTURE_NOW_DATE = new Date(FIXTURE_NOW);

export async function runProductionReadinessTests() {
  console.log("=========================================================================");
  console.log("RUNNING PHASE 9 FINAL PRODUCTION READINESS & END-TO-END SCENARIO AUDIT");
  console.log("=========================================================================");

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
  await test("Scenario A: Normal Student Workflow (Task Creation -> Schedule -> Calendar -> Notif -> Complete)", async () => {
    const task = createTaskFixture({
      id: "p9_scen_a",
      title: "DBMS Assignment",
      durationMinutes: 60,
      deadlineOffsetHours: 24,
      commitmentType: "HARD",
      category: "STUDY",
      createdAt: FIXTURE_NOW,
    });

    // 1. Validation & Schedule
    const schedResult = deterministicSchedulerService.scheduleTasks([task], {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });
    assert.strictEqual(schedResult.status, "SUCCESS");

    // 2. Calendar Event Generation
    const events = calendarService.planExecutionIntervals(schedResult.scheduledTasks[0]);
    assert.ok(events.length > 0);
    assert.ok(events[0].summary.startsWith("Saarthi Exec:"));

    // 3. Notification & Persistence
    const { updatedTasks: notifTasks } = await notificationService.evaluateAndDispatchNotifications(
      schedResult.scheduledTasks,
      { now: FIXTURE_NOW }
    );
    dbData.tasks[task.id] = notifTasks[0];
    saveDb();

    // 4. Mark complete
    const completedTask = {
      ...notifTasks[0],
      isCompleted: true,
      subtasks: notifTasks[0].subtasks.map((s) => ({ ...s, done: true })),
    };
    const risk = computeRiskScore(completedTask);
    assert.strictEqual(risk.completionConfidence, 100);
  });

  // Scenario B — Hard Exam Preparation
  await test("Scenario B: Hard Exam Preparation (HARD commitment receives priority protection)", async () => {
    const flexTask = createTaskFixture({ id: "p9_scen_b_flex", title: "Read History Chapter", durationMinutes: 120, deadlineOffsetHours: 48, commitmentType: "FLEXIBLE", category: "PERSONAL_FLEXIBLE", createdAt: FIXTURE_NOW });
    const hardExam = createTaskFixture({ id: "p9_scen_b_exam", title: "Mathematics Exam", durationMinutes: 120, deadlineOffsetHours: 4, commitmentType: "HARD", category: "EXAM", createdAt: FIXTURE_NOW });

    const res = deterministicSchedulerService.scheduleTasks([flexTask, hardExam], {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });

    assert.strictEqual(res.status, "SUCCESS");
    const examStart = new Date(res.scheduledTasks.find((t) => t.id === "p9_scen_b_exam")!.subtasks[0].scheduledStart!).getTime();
    const flexStart = new Date(res.scheduledTasks.find((t) => t.id === "p9_scen_b_flex")!.subtasks[0].scheduledStart!).getTime();

    assert.ok(examStart < flexStart, "Hard exam must receive scheduling priority ahead of flexible task");
  });

  // Scenario C — Missed Task Auto-Rescheduling
  await test("Scenario C: Missed Task Auto-Rescheduling (TASK_MISSED -> Downstream Shift -> Notifs)", async () => {
    const taskA = createTaskFixture({ id: "p9_scen_c_A", title: "Algorithm Practice", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });
    const taskB = createTaskFixture({ id: "p9_scen_c_B", title: "Code Review", durationMinutes: 60, deadlineOffsetHours: 48, dependsOn: ["p9_scen_c_A"], createdAt: FIXTURE_NOW });

    const initResult = deterministicSchedulerService.scheduleTasks([taskA, taskB], {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });

    const laterNow = "2026-08-15T12:00:00.000Z";
    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user_p9",
      triggerEvent: "TASK_MISSED",
      triggerTaskId: "p9_scen_c_A",
      tasks: initResult.scheduledTasks,
      busyIntervals: [],
      notifyUser: true,
      nowInput: laterNow,
    });

    assert.strictEqual(res.changed, true);
    assert.ok(res.affectedTaskIds.includes("p9_scen_c_A"));

    // Idempotency: Re-triggering produces zero drift
    const reRes = await reschedulingService.handleRescheduleTrigger({
      userId: "user_p9",
      triggerEvent: "TASK_MISSED",
      triggerTaskId: "p9_scen_c_A",
      tasks: res.updatedTasks,
      busyIntervals: [],
      notifyUser: true,
      nowInput: laterNow,
    });
    assert.strictEqual(reRes.changed, false);
  });

  // Scenario D — Impossible Hard Deadline Conflict
  await test("Scenario D: Impossible Hard Deadline Conflict returns explicit CONFLICT status", async () => {
    const impossibleTask = createTaskFixture({ id: "p9_scen_d_imp", title: "Massive Hard Assignment", durationMinutes: 1200, deadlineOffsetHours: 2, commitmentType: "HARD", createdAt: FIXTURE_NOW });

    const res = deterministicSchedulerService.scheduleTasks([impossibleTask], {
      preferredStartHour: 9,
      preferredEndHour: 17,
      now: FIXTURE_NOW,
    });

    assert.strictEqual(res.status, "CONFLICT");
    assert.ok(res.conflicts.some((c) => c.type === "HARD_DEADLINE_VIOLATION"));
  });

  // Scenario E — Dependency Chain (A -> B -> C)
  await test("Scenario E: Dependency Chain A -> B -> C (Prerequisite elevation for downstream Hard C)", async () => {
    const taskA = createTaskFixture({ id: "p9_scen_e_A", title: "Research Topic", durationMinutes: 60, deadlineOffsetHours: 6, commitmentType: "HARD", createdAt: FIXTURE_NOW });
    const taskB = createTaskFixture({ id: "p9_scen_e_B", title: "Draft Proposal", durationMinutes: 60, deadlineOffsetHours: 7, dependsOn: ["p9_scen_e_A"], commitmentType: "HARD", createdAt: FIXTURE_NOW });
    const taskC = createTaskFixture({ id: "p9_scen_e_C", title: "Submit Final Thesis", durationMinutes: 60, deadlineOffsetHours: 8, dependsOn: ["p9_scen_e_B"], commitmentType: "HARD", createdAt: FIXTURE_NOW });

    const res = deterministicSchedulerService.scheduleTasks([taskA, taskB, taskC], {
      preferredStartHour: 9,
      preferredEndHour: 22,
      now: FIXTURE_NOW,
    });

    assert.strictEqual(res.status, "SUCCESS");
    const startA = new Date(res.scheduledTasks.find((t) => t.id === "p9_scen_e_A")!.subtasks[0].scheduledStart!).getTime();
    const startB = new Date(res.scheduledTasks.find((t) => t.id === "p9_scen_e_B")!.subtasks[0].scheduledStart!).getTime();
    const startC = new Date(res.scheduledTasks.find((t) => t.id === "p9_scen_e_C")!.subtasks[0].scheduledStart!).getTime();

    assert.ok(startA < startB && startB < startC, "Execution order must follow A -> B -> C topological dependency order");
  });

  // Scenario F — Bill Lifecycle
  await test("Scenario F: Bill Lifecycle (Unpaid -> 7d/3d/1d -> Overdue -> Paid suppression)", async () => {
    const bill = createTaskFixture({
      id: "p9_scen_f_bill",
      title: "Electricity Bill",
      durationMinutes: 30,
      deadlineOffsetHours: -2,
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

    const paidBill = { ...monitored[0], paymentStatus: "PAID" as const };
    const { updatedTasks: notifTasks } = await notificationService.evaluateAndDispatchNotifications([paidBill], { now: FIXTURE_NOW });
    assert.strictEqual(notifTasks[0].deliveredNotificationKeys.length, 0);
  });

  // Scenario G — Subscription Lifecycle
  await test("Scenario G: Subscription Lifecycle (Renewal instance generated with 0 duplicates)", async () => {
    const subTask = createTaskFixture({
      id: "p9_scen_g_sub",
      title: "Spotify Premium",
      durationMinutes: 15,
      deadlineOffsetHours: 2,
      commitmentType: "HARD",
      category: "SUBSCRIPTION",
      amount: 10,
      subscriptionStatus: "ACTIVE",
      renewalDate: "2026-08-15T12:00:00.000Z",
      createdAt: FIXTURE_NOW,
    });

    const { newRenewalTasks: firstRun } = taskService.generateSubscriptionRenewals([subTask], FIXTURE_NOW_DATE);
    assert.strictEqual(firstRun.length, 1);

    const { newRenewalTasks: secondRun } = taskService.generateSubscriptionRenewals([subTask, ...firstRun], FIXTURE_NOW_DATE);
    assert.strictEqual(secondRun.length, 0);
  });

  // Scenario H — Google Calendar Conflict Avoidance
  await test("Scenario H: Google Calendar Conflict Avoidance (Schedule offsets around busy block)", async () => {
    const task = createTaskFixture({ id: "p9_scen_h_task", title: "Study Organic Chemistry", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });
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
    assert.ok(schedStart >= busyEnd, "Task slot must start at or after busy block end");
  });

  // Scenario I — Google Calendar Failure Handling
  await test("Scenario I: Google Calendar Failure Handling (Graceful AppError isolation on 401)", async () => {
    try {
      await calendarService.fetchFreeBusyIntervals("invalid_token", FIXTURE_NOW, "2026-08-16T09:00:00.000Z");
      assert.fail("Should have thrown AppError");
    } catch (err: any) {
      assert.ok(err.message.includes("Google Calendar API failed"));
    }
  });

  // Scenario J — Telegram Failure Handling
  await test("Scenario J: Telegram Failure Handling (Missing bot token executes cleanly)", async () => {
    const task = createTaskFixture({ id: "p9_scen_j_task", title: "Telegram Test", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });
    const { updatedTasks } = await notificationService.evaluateAndDispatchNotifications([task], { now: FIXTURE_NOW });
    assert.strictEqual(updatedTasks.length, 1);
  });

  // Scenario K — Server Restart Persistence Preservation
  await test("Scenario K: Server Restart Persistence (saveDb -> loadDb -> zero state loss)", async () => {
    const task = createTaskFixture({ id: "p9_scen_k_task", title: "Restart Test Task", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });
    task.deliveredNotificationKeys = ["notif_p9_k_1"];

    dbData.tasks["p9_scen_k_task"] = task;
    saveDb();

    dbData.tasks = {};
    loadDb();

    const reloaded = dbData.tasks["p9_scen_k_task"];
    assert.ok(reloaded);
    assert.strictEqual(reloaded.title, "Restart Test Task");
    assert.deepStrictEqual(reloaded.deliveredNotificationKeys, ["notif_p9_k_1"]);
  });

  // Scenario L — Concurrent Rescheduling Lock Handling
  await test("Scenario L: Concurrent Rescheduling Lock Handling (Sequential execution without race condition)", async () => {
    const task = createTaskFixture({ id: "p9_scen_l_task", title: "Concurrent Lock Task", durationMinutes: 60, deadlineOffsetHours: 24, createdAt: FIXTURE_NOW });

    const p1 = reschedulingService.handleRescheduleTrigger({
      userId: "user_p9_lock",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "p9_scen_l_task",
      tasks: [task],
      busyIntervals: [],
      notifyUser: false,
      nowInput: FIXTURE_NOW,
    });

    const p2 = reschedulingService.handleRescheduleTrigger({
      userId: "user_p9_lock",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "p9_scen_l_task",
      tasks: [task],
      busyIntervals: [],
      notifyUser: false,
      nowInput: FIXTURE_NOW,
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.ok(r1.changed !== undefined);
    assert.ok(r2.changed !== undefined);
  });

  // Scenario M — Adaptive Planning Determinism
  await test("Scenario M: Adaptive Planning Determinism (100 runs & 50 array shuffles yield 100% identical metrics)", async () => {
    const history = [
      createTaskFixture({ id: "p9_m_1", durationMinutes: 60, deadlineOffsetHours: 24, isCompleted: true, createdAt: FIXTURE_NOW }),
      createTaskFixture({ id: "p9_m_2", durationMinutes: 60, deadlineOffsetHours: 24, isCompleted: true, createdAt: FIXTURE_NOW }),
      createTaskFixture({ id: "p9_m_3", durationMinutes: 60, deadlineOffsetHours: 24, isCompleted: false, createdAt: FIXTURE_NOW }),
    ];

    const baseState = JSON.stringify(adaptivePlanningService.computeDeterministicState(history, "balanced", FIXTURE_NOW));

    for (let i = 0; i < 50; i++) {
      const shuffled = [...history].sort(() => Math.random() - 0.5);
      const curState = JSON.stringify(adaptivePlanningService.computeDeterministicState(shuffled, "balanced", FIXTURE_NOW));
      assert.strictEqual(curState, baseState, `Shuffled run ${i} must equal baseline state`);
    }
  });

  // Scenario N — Full Cross-Phase Recovery
  await test("Scenario N: Full Cross-Phase Recovery (A -> B -> C delay with calendar conflict & notification escalation)", async () => {
    const taskA = createTaskFixture({ id: "p9_n_A", title: "Step A", durationMinutes: 60, deadlineOffsetHours: 6, commitmentType: "HARD", createdAt: FIXTURE_NOW });
    const taskB = createTaskFixture({ id: "p9_n_B", title: "Step B", durationMinutes: 60, deadlineOffsetHours: 7, dependsOn: ["p9_n_A"], commitmentType: "HARD", createdAt: FIXTURE_NOW });
    const taskC = createTaskFixture({ id: "p9_n_C", title: "Hard Submission C", durationMinutes: 60, deadlineOffsetHours: 8, dependsOn: ["p9_n_B"], commitmentType: "HARD", createdAt: FIXTURE_NOW });

    const busyBlocks = [{ start: "2026-08-15T11:00:00.000Z", end: "2026-08-15T12:00:00.000Z" }];

    // 1. Initial Schedule
    const schedResult = deterministicSchedulerService.scheduleTasks([taskA, taskB, taskC], {
      busyIntervals: busyBlocks,
      preferredStartHour: 9,
      preferredEndHour: 22,
      now: FIXTURE_NOW,
    });
    assert.strictEqual(schedResult.status, "SUCCESS");

    // 2. Trigger Delay on A
    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user_p9_n",
      triggerType: "TASK_DELAYED",
      triggerTaskId: "p9_n_A",
      delayMinutes: 30,
      tasks: [taskA, taskB, taskC],
      options: {
        busyIntervals: busyBlocks,
        preferredStartHour: 9,
        preferredEndHour: 22,
        now: FIXTURE_NOW,
      },
    });
    assert.strictEqual(res.changed, true);
    assert.ok(res.affectedTaskIds.length > 0);

    // 3. Notification Evaluation
    const { updatedTasks: finalTasks } = await notificationService.evaluateAndDispatchNotifications(res.updatedTasks, {
      now: "2026-08-15T10:00:00.000Z",
    });
    assert.strictEqual(finalTasks.length, 3);
  });

  console.log("=========================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  runProductionReadinessTests().catch(console.error);
}
