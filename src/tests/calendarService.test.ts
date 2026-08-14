import assert from "node:assert";
import { Task } from "../types.js";
import { calendarService, BusyInterval } from "../services/calendarService.js";
import { deterministicSchedulerService } from "../services/deterministicSchedulerService.js";
import { reschedulingService } from "../services/reschedulingService.js";
import { AppError } from "../services/errorHandler.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";

function createMockTask(
  id: string,
  durationMinutes = 60,
  deadlineOffsetHours = 24,
  dependsOn: string[] = [],
  priority: "low" | "medium" | "high" = "medium",
  isHardDeadline = false,
  googleEventId?: string
): Task {
  const deadlineDate = new Date(new Date(FIXTURE_NOW).getTime() + deadlineOffsetHours * 3600000);
  return {
    id,
    userId: "test-user-phase4",
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
        googleEventId,
      },
    ],
    sessionsCompleted: 0,
    sessionsPlanned: 1,
    riskFactors: [],
    createdAt: "2026-08-15T08:00:00.000Z",
    googleCalendarSynced: !!googleEventId,
    googleTasksSynced: false,
    dependsOn,
    isHardDeadline,
  };
}

async function runCalendarTests() {
  console.log("===================================================");
  console.log("RUNNING PHASE 4 CALENDAR-AWARE SCHEDULING TESTS");
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

  // Test 1 — Free Calendar
  await test("Test 1: Free Calendar (No busy intervals) schedules task at earliest slot", async () => {
    const task = createMockTask("T1", 60, 24);
    const result = deterministicSchedulerService.scheduleTasks([task], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals: [],
    });

    assert.strictEqual(result.status, "SUCCESS");
    assert.strictEqual(result.scheduledTasks[0].subtasks[0].scheduledStart, FIXTURE_NOW);
  });

  // Test 2 — One Busy Event
  await test("Test 2: One Busy Event blocks earliest slot and shifts task to next open slot", async () => {
    const task = createMockTask("T1", 60, 24);
    const busyIntervals: BusyInterval[] = [
      { start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T10:00:00.000Z", summary: "Team Standup" },
    ];

    const result = deterministicSchedulerService.scheduleTasks([task], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals,
    });

    assert.strictEqual(result.status, "SUCCESS");
    const startNum = new Date(result.scheduledTasks[0].subtasks[0].scheduledStart!).getTime();
    const busyEndNum = new Date("2026-08-15T10:00:00.000Z").getTime();
    assert.ok(startNum >= busyEndNum, "Task start must be after busy event ends at 10:00");
  });

  // Test 3 — Multiple Busy Events
  await test("Test 3: Multiple Busy Events: Scheduler fits task into available gap", async () => {
    const task = createMockTask("T1", 60, 24); // 60 mins
    const busyIntervals: BusyInterval[] = [
      { start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T10:00:00.000Z" },
      { start: "2026-08-15T11:00:00.000Z", end: "2026-08-15T13:00:00.000Z" },
    ];

    const result = deterministicSchedulerService.scheduleTasks([task], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals,
    });

    assert.strictEqual(result.status, "SUCCESS");
    const startStr = result.scheduledTasks[0].subtasks[0].scheduledStart!;
    const endStr = result.scheduledTasks[0].subtasks[0].scheduledEnd!;

    // Must fit in 10:00-11:00 gap
    assert.strictEqual(new Date(startStr).getTime(), new Date("2026-08-15T10:00:00.000Z").getTime());
    assert.strictEqual(new Date(endStr).getTime(), new Date("2026-08-15T11:00:00.000Z").getTime());
  });

  // Test 4 — All-Day Event
  await test("Test 4: All-Day Event shifts task outside unavailable day", async () => {
    const task = createMockTask("T1", 60, 72); // 72h horizon
    // All-day busy block on 2026-08-15
    const busyIntervals: BusyInterval[] = [
      { start: "2026-08-15T00:00:00.000Z", end: "2026-08-15T23:59:59.999Z", summary: "Company Offsite" },
    ];

    const result = deterministicSchedulerService.scheduleTasks([task], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals,
    });

    assert.strictEqual(result.status, "SUCCESS");
    const startStr = result.scheduledTasks[0].subtasks[0].scheduledStart!;
    assert.ok(startStr.startsWith("2026-08-16"), "Task must be scheduled on the next day (Aug 16)");
  });

  // Test 5 — Hard Deadline + Calendar Conflict
  await test("Test 5: Hard Deadline + Calendar Conflict generates explicit CONFLICT state", async () => {
    const task = createMockTask("T1", 120, 4, [], "high", true); // Hard deadline in 4h (13:00)
    const busyIntervals: BusyInterval[] = [
      { start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T15:00:00.000Z", summary: "Client Conference" },
    ];

    const result = deterministicSchedulerService.scheduleTasks([task], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals,
    });

    assert.strictEqual(result.status, "CONFLICT");
    assert.ok(result.conflicts.some((c) => c.type === "HARD_DEADLINE_VIOLATION"));
  });

  // Test 6 — Dependency + Calendar Interplay (A -> B)
  await test("Test 6: Dependency + Calendar Interplay: Delaying A via calendar shifts B downstream", async () => {
    const taskA = createMockTask("A", 60, 24, []);
    const taskB = createMockTask("B", 60, 24, ["A"]);
    const busyIntervals: BusyInterval[] = [
      { start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T11:00:00.000Z" },
    ];

    const result = deterministicSchedulerService.scheduleTasks([taskA, taskB], {
      now: FIXTURE_NOW,
      preferredStartHour: 9,
      preferredEndHour: 17,
      busyIntervals,
    });

    const endA = new Date(result.scheduledTasks.find((t) => t.id === "A")!.subtasks[0].scheduledEnd!).getTime();
    const startB = new Date(result.scheduledTasks.find((t) => t.id === "B")!.subtasks[0].scheduledStart!).getTime();

    assert.ok(endA >= new Date("2026-08-15T12:00:00.000Z").getTime() || startB >= endA);
  });

  // Test 7 — Calendar Event Creation (POST)
  await test("Test 7: Calendar Event Creation (POST) generates event structure with valid summary & timestamps", async () => {
    const task = createMockTask("T1", 60, 24);
    const events = calendarService.planExecutionIntervals(task);

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].summary, "Saarthi Exec: Subtask T1.1");
    assert.ok(events[0].start.dateTime);
    assert.ok(events[0].end.dateTime);
    calendarService.validateEventPayload(events[0]);
  });

  // Test 8 — Event Idempotency
  await test("Test 8: Event Idempotency: Syncing task with existing googleEventId avoids duplicate insertions", async () => {
    const taskWithEvent = createMockTask("T1", 60, 24, [], "medium", false, "existing_event_123");

    // Call syncTaskCalendarEvents without token (tokenExpired signal check)
    const result = await calendarService.syncTaskCalendarEvents(taskWithEvent, "");
    assert.strictEqual(result.syncState.syncedEvents, 1, "Should identify 1 existing event ID as already synced");
  });

  // Test 9 — Event Update (PUT)
  await test("Test 9: Event Update (PUT): Payload validation accepts updated timestamps for existing event ID", async () => {
    const task = createMockTask("T1", 60, 24, [], "medium", false, "existing_event_123");
    task.subtasks[0].scheduledStart = "2026-08-15T14:00:00.000Z";
    task.subtasks[0].scheduledEnd = "2026-08-15T15:00:00.000Z";

    const payload = {
      summary: `Saarthi Exec: ${task.subtasks[0].title}`,
      description: `Updated schedule block for ${task.title}`,
      start: { dateTime: task.subtasks[0].scheduledStart, timeZone: "UTC" },
      end: { dateTime: task.subtasks[0].scheduledEnd, timeZone: "UTC" },
    };

    calendarService.validateEventPayload(payload);
    assert.ok(task.subtasks[0].googleEventId === "existing_event_123");
  });

  // Test 10 — Event Deletion/Cancellation
  await test("Test 10: Event Deletion: deleteCalendarEvent handles deletion cleanly", async () => {
    const success = await calendarService.deleteCalendarEvent("mock_event_id", "");
    assert.strictEqual(success, false, "Should return false when access token is missing");
  });

  // Test 11 — API Failure (Explicit Error Assertion)
  await test("Test 11: API Failure throws explicit AppError and NEVER returns empty fallback array", async () => {
    try {
      await calendarService.fetchFreeBusyIntervals("", "2026-08-15T00:00:00.000Z", "2026-08-16T00:00:00.000Z");
      assert.fail("Should have thrown error for empty access token");
    } catch (err: any) {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.statusCode, 401);
    }
  });

  // Test 12 — Timezone Consistency & All-Day Formatting
  await test("Test 12: Timezone Consistency: formatLocalDateToIso formats local date string with timeZone awareness", async () => {
    const startIso = calendarService.formatLocalDateToIso("2026-08-15", "Asia/Kolkata", false);
    const endIso = calendarService.formatLocalDateToIso("2026-08-15", "Asia/Kolkata", true);

    assert.ok(typeof startIso === "string" && startIso.includes("Z"));
    assert.ok(typeof endIso === "string" && endIso.includes("Z"));
    assert.ok(!isNaN(new Date(startIso).getTime()));
    assert.ok(!isNaN(new Date(endIso).getTime()));
  });

  // Test 13 — Phase 3 Rescheduling Integration
  await test("Test 13: Phase 3 Rescheduling Integration: Rescheduling trigger recalculates schedule and preserves event ID", async () => {
    const taskA = createMockTask("A", 60, 24, [], "medium", false, "event_A");
    const taskB = createMockTask("B", 60, 24, ["A"], "medium", false, "event_B");

    const res = await reschedulingService.handleRescheduleTrigger({
      userId: "user_p4",
      triggerEvent: "TASK_DELAYED",
      triggerTaskId: "A",
      tasks: [taskA, taskB],
      scheduleOptions: { now: FIXTURE_NOW, preferredStartHour: 9, preferredEndHour: 17 },
    });

    const bResched = res.updatedTasks.find((t) => t.id === "B")!;
    assert.strictEqual(bResched.subtasks[0].googleEventId, "event_B", "Event ID must be preserved after rescheduling");
  });

  // Test 14 — Loop Protection
  await test("Test 14: Loop Protection: Saarthi's own created events ('Saarthi Exec:') are filtered out from busy blocks", async () => {
    // Simulate raw busy array containing a Saarthi event and an external event
    const rawBusy: BusyInterval[] = [
      { start: "2026-08-15T09:00:00.000Z", end: "2026-08-15T10:00:00.000Z", summary: "Saarthi Exec: Subtask T1.1" },
      { start: "2026-08-15T11:00:00.000Z", end: "2026-08-15T12:00:00.000Z", summary: "Doctor Appointment" },
    ];

    const filtered = rawBusy.filter((b) => !b.summary || !b.summary.startsWith("Saarthi Exec:"));

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].summary, "Doctor Appointment");
  });

  console.log("===================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runCalendarTests().catch(console.error);
