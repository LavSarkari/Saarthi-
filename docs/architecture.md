# System Architecture

## High-Level System Architecture
Saarthi is a React 19 (Vite) Single Page Application (SPA) backed by a Node.js/Express application. The system operates on a hybrid architecture combining real-time client state, Firebase Cloud infrastructure, server-side AI processing, and a deterministic backend scheduling engine.

```
                    ┌────────────────────────────┐
                    │      React SPA Frontend    │
                    └────────────────────────────┘
                         │                  │
      (Google Auth &     │                  │ (REST & WebSockets)
       Firestore Sync)   ▼                  ▼
             ┌──────────────────┐    ┌──────────────────────────────────┐
             │ Firebase Cloud   │    │ Express Server (Port 3000)       │
             │ (Auth & DB)      │    └──────────────────────────────────┘
             └──────────────────┘       │               │            │
   ┌────────────────────────────────────┼───────────────┘            │
   ▼                                    ▼                            ▼
[Deterministic Scheduler]      [Dependency DAG]            [Local DB Engine]
 (Phase 2 & Phase 3)            (Phase 1 DFS Cycle)         (Atomic JSON Store)
   │                                    │                            │
   ▼                                    ▼                            ▼
[Google Calendar API]        [Notification Engine]        [Telegram Bot Service]
 (Free/Busy & Sync)           (Escalation & Override)       (Polling & Webhooks)
```

## Dual-Persistence & Auth Architecture
- **Firebase Auth (`src/lib/firebase.ts`)**: Handles Google OAuth user login and authentication.
- **Firebase Firestore (`src/lib/firebase.ts`)**: Cloud database for user document storage and cross-device sync.
- **Local DB Engine (`src/services/localDb.ts`)**: Server-side crash-safe JSON database (`data/local_db.json`) enabling zero-latency backend ticks, background monitor worker cycles, and Telegram bot updates without hitting Firestore API quotas.

## Core Execution Engines

### 1. Dependency Graph Engine (`src/lib/dependencyGraph.ts`)
- **Directed Acyclic Graph (DAG)**: Manages task prerequisite relationships.
- **Topological Sort**: Computes execution order using Kahn's algorithm.
- **Cycle Detection**: Prevents circular dependencies using 3-color Depth First Search (DFS).
- **Priority Elevation**: Automatically elevates prerequisite tasks when downstream tasks are critical `HARD` commitments.

### 2. Deterministic Scheduler (`src/services/deterministicSchedulerService.ts`)
- **Authority**: Serves as the single scheduling authority.
- **Slot Allocation**: Allocates subtasks into non-overlapping working hour windows (09:00–22:00 default).
- **Conflict Handling**: Detects hard deadline violations and returns explicit `CONFLICT` status rather than silently violating commitments.
- **100% Determinism**: Zero reliance on non-deterministic heuristics or `Math.random()`.

### 3. Automatic Rescheduling Service (`src/services/reschedulingService.ts`)
- **Event-Driven**: Continuously reacts to triggers (`TASK_DELAYED`, `TASK_COMPLETED_EARLY`, `TASK_MISSED`, `DEPENDENCY_CHANGED`).
- **Sequential Locking**: Per-user async mutex prevents race conditions on rapid state triggers.
- **Minimal Drift**: Recalculates only downstream affected sub-graphs to maintain user schedule stability.

### 4. Notification Engine (`src/services/notificationService.ts`)
- **Monotonic Progression**: Tracks stage transitions (`UPCOMING` -> `APPROACHING` -> `URGENT` -> `CRITICAL` -> `OVERDUE`).
- **Deduplication**: Keyed by `${taskId}:${stage}:${deadline}` in `deliveredNotificationKeys` to guarantee zero notification spam across server restarts.
- **Batching & Override**: Groups non-critical alerts into single briefing digests while prioritizing `HARD` deadline overrides.

### 5. Atomic Storage & Recovery (`src/services/localDb.ts`)
- **Atomic Writes**: Writes to `local_db.json.tmp` and renames atomically via `fs.renameSync()`.
- **Corruption Safeguard**: Creates timestamped backup copies (`local_db.json.corrupt.<timestamp>`) if JSON corruption occurs, initializing safe default structures.

## External Service Integrations
- **Firebase Auth & Firestore**: User login and cloud task persistence.
- **Google Calendar API**: Synchronizes schedule blocks using `Saarthi Exec:` prefixes for loop protection.
- **Telegram Bot API**: Polling and Webhook integration delivering interactive briefings and urgent alerts.
- **Google Gemini AI**: Powers natural language goal decomposition, OCR syllabus analysis, and voice interaction.
