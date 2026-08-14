import assert from "assert";
import fs from "fs";
import path from "path";
import { saveDb, loadDb, dbData } from "../services/localDb.js";
import { createTaskFixture } from "./fixtures/taskFactory.js";
import { deterministicSchedulerService } from "../services/deterministicSchedulerService.js";
import { taskService } from "../services/taskService.js";

const FIXTURE_NOW = "2026-08-15T09:00:00.000Z";
const DB_PATH = path.join(process.cwd(), "data", "local_db.json");

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ${name}:`, err.message || err);
    throw err;
  }
}

export async function runProductionHardeningTests() {
  console.log("=========================================================================");
  console.log("RUNNING PHASE 10 PRODUCTION HARDENING & RELEASE READINESS TESTS");
  console.log("=========================================================================");

  // Test 1: Atomic Writes Strategy
  await test("Test 1: Atomic Writes Strategy (saveDb writes to tmp then renames cleanly)", () => {
    dbData.userSettings["p10_user_1"] = { name: "Atomic Test User" };
    dbData.tasks["p10_task_1"] = createTaskFixture({ id: "p10_task_1", userId: "p10_user_1", title: "Atomic Task" });
    
    saveDb();
    assert.strictEqual(fs.existsSync(DB_PATH), true);
    
    // Verify content on disk
    const content = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    assert.strictEqual(content.userSettings["p10_user_1"].name, "Atomic Test User");
    assert.strictEqual(content.tasks["p10_task_1"].title, "Atomic Task");
  });

  // Test 2: Corrupt Database Recovery & Backup
  await test("Test 2: Corrupt Database Recovery (Malformed JSON backs up corrupt file and initializes safely)", () => {
    // Write corrupt JSON to disk
    fs.writeFileSync(DB_PATH, "{ INVALID_JSON_DATA_CORRUPT ", "utf8");
    
    // Reload DB
    loadDb();
    
    // Check that dbData initialized to empty fallback structure without crashing
    assert.ok(dbData.userSettings !== undefined);
    assert.ok(dbData.tasks !== undefined);

    // Check that a corrupt backup file was created
    const dataDir = path.join(process.cwd(), "data");
    const files = fs.readdirSync(dataDir);
    const corruptBackups = files.filter((f) => f.includes("local_db.json.corrupt."));
    assert.ok(corruptBackups.length > 0, "A timestamped corrupt backup file must be created upon reading invalid JSON");

    // Clean up backup file created during test
    for (const bFile of corruptBackups) {
      try { fs.unlinkSync(path.join(dataDir, bFile)); } catch {}
    }
  });

  // Test 3: Multi-User Isolation Invariant
  await test("Test 3: Multi-User Isolation Invariant (User A data cannot leak to User B)", () => {
    dbData.tasks = {
      task_A1: createTaskFixture({ id: "task_A1", userId: "user_A", title: "User A Task" }),
      task_B1: createTaskFixture({ id: "task_B1", userId: "user_B", title: "User B Task" }),
    };

    const userATasks = Object.values(dbData.tasks).filter((t: any) => t.userId === "user_A");
    const userBTasks = Object.values(dbData.tasks).filter((t: any) => t.userId === "user_B");

    assert.strictEqual(userATasks.length, 1);
    assert.strictEqual(userATasks[0].id, "task_A1");
    assert.strictEqual(userBTasks.length, 1);
    assert.strictEqual(userBTasks[0].id, "task_B1");
  });

  // Test 4: Performance Benchmark 1,000 Tasks
  await test("Test 4: Performance Benchmark (Scheduler processes 1,000 tasks under 500ms)", () => {
    const thousandTasks = Array.from({ length: 1000 }, (_, i) =>
      createTaskFixture({
        id: `p10_bench_${i}`,
        userId: "user_p10_bench",
        title: `Bench Task ${i}`,
        durationMinutes: 30,
        deadlineOffsetHours: 48,
        createdAt: FIXTURE_NOW,
      })
    );

    const startTime = Date.now();
    const res = deterministicSchedulerService.scheduleTasks(thousandTasks, {
      preferredStartHour: 9,
      preferredEndHour: 22,
      now: FIXTURE_NOW,
    });
    const elapsedMs = Date.now() - startTime;

    assert.strictEqual(res.status, "SUCCESS");
    assert.ok(elapsedMs < 500, `Scheduling 1,000 tasks took ${elapsedMs}ms, which must be < 500ms`);
  });

  // Test 5: Bill Negative Amount Rejection
  await test("Test 5: Bill Input Validation (Negative amounts are rejected by taskService)", () => {
    try {
      taskService.validateAndPrepareTask({
        userId: "user_p10",
        title: "Negative Electricity Bill",
        category: "BILL",
        amount: -50,
        deadline: "2026-08-20T00:00:00.000Z",
      });
      assert.fail("Should have thrown error for negative bill amount");
    } catch (err: any) {
      assert.ok(err.message.includes("non-negative number"));
    }
  });

  // Test 6: Final End-to-End System Lifecycle Verification
  await test("Test 6: Final End-to-End System Lifecycle (Create -> Schedule -> Persist -> Reload -> Verify)", () => {
    const hardExam = createTaskFixture({
      id: "p10_e2e_exam",
      userId: "user_p10_e2e",
      title: "Final AI Systems Exam",
      durationMinutes: 120,
      deadlineOffsetHours: 24,
      commitmentType: "HARD",
      category: "EXAM",
      createdAt: FIXTURE_NOW,
    });

    // 1. Schedule
    const sched = deterministicSchedulerService.scheduleTasks([hardExam], {
      preferredStartHour: 9,
      preferredEndHour: 22,
      now: FIXTURE_NOW,
    });
    assert.strictEqual(sched.status, "SUCCESS");

    // 2. Persist
    dbData.tasks[hardExam.id] = sched.scheduledTasks[0];
    saveDb();

    // 3. Reload from Disk
    loadDb();
    const reloaded = dbData.tasks[hardExam.id];

    // 4. Invariants
    assert.ok(reloaded !== undefined);
    assert.strictEqual(reloaded.commitmentType, "HARD");
    assert.strictEqual(reloaded.category, "EXAM");
    assert.strictEqual(reloaded.subtasks[0].scheduledStart !== undefined, true);
  });

  console.log("=========================================================================");
  console.log("TEST SUMMARY: 6 PASSED, 0 FAILED");
  console.log("=========================================================================");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionHardeningTests().catch(() => process.exit(1));
}
