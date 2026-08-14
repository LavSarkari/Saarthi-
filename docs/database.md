# Database & Persistence Architecture

## Dual-Persistence Architecture

Saarthi operates a dual-persistence strategy:

1. **Client & Auth Layer (Firebase Firestore & Firebase Auth)**:
   - Client components (`src/App.tsx`, `src/lib/firebase.ts`) connect to Firebase Auth for Google OAuth authentication.
   - User tasks, settings, and behavioral events sync to Firebase Firestore for cloud persistence across devices.

2. **Server Execution & Offline Layer (`src/services/localDb.ts`)**:
   - The Express backend operates an in-memory & crash-safe local JSON database engine backed by `data/local_db.json`.
   - Provides zero-latency reads/writes for background workers, Telegram bot integrations, and deterministic scheduling without consuming Cloud Firestore read/write quotas or introducing network latency during scheduling ticks.

```
┌────────────────────────────────────────────────────────┐
│                   React 19 Frontend                    │
└────────────────────────────────────────────────────────┘
       │                                     │
       ▼ (Google OAuth & Cloud Sync)         ▼ (REST / WebSockets)
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  Firebase Auth & Firestore   │     │  Express Server (Port 3000)  │
└──────────────────────────────┘     └──────────────────────────────┘
                                                     │
                                                     ▼ (Atomic Writes)
                                     ┌──────────────────────────────┐
                                     │  data/local_db.json Engine   │
                                     └──────────────────────────────┘
```

---

## Schema & Collections

### 1. `tasks` Collection
Keyed by `taskId`. Represents user commitments and their associated scheduling metadata:

- **`id`** (`string`): Unique task identifier.
- **`userId`** (`string`): Owner user ID.
- **`title`** (`string`): Title of commitment.
- **`totalEffortMinutes`** (`number`): Total estimated effort across subtasks.
- **`commitmentType`** (`"HARD" | "FLEXIBLE"`): Canonical scheduling commitment semantics.
- **`category`** (`"EXAM" | "INTERVIEW" | "BILL" | "SUBSCRIPTION" | "MILESTONE" | "PERSONAL_FLEXIBLE" | "STUDY"`): Commitment classification.
- **`deadline`** (`string` ISO date): Target completion timestamp.
- **`isHardDeadline`** (`boolean`): Derived strictly from `commitmentType === "HARD"`.
- **`dependsOn`** (`string[]`): Array of prerequisite task IDs enforced by the Phase 1 Dependency Engine.
- **`riskScore`** (`number`): Deterministically computed risk score ($0–100$).
- **`riskZone`** (`"safe" | "watch" | "critical"`): Visual risk zone.
- **`paymentStatus`** (`"UNPAID" | "PAID" | "OVERDUE"`): Bill payment state.
- **`subscriptionStatus`** (`"ACTIVE" | "CANCELLED" | "EXPIRED"`): Subscription renewal state.
- **`renewalDate`** (`string` ISO date): Subscription renewal target date.
- **`deliveredNotificationKeys`** (`string[]`): Set of notification keys delivered (prevents duplicate alerts).
- **`subtasks`** (`Subtask[]`): Allocated execution blocks:
  - `id` (`string`)
  - `title` (`string`)
  - `estimatedMinutes` (`number`)
  - `scheduledStart` (`string` ISO date)
  - `scheduledEnd` (`string` ISO date)
  - `googleEventId` (`string`)

### 2. `userSettings` Collection
Keyed by `userId`. Stores user configuration:

- **`telegramChatId`** (`string` | `number`): Linked Telegram chat ID.
- **`telegramAlertsEnabled`** (`boolean`): Toggle for automated Telegram notifications.
- **`telegramAlertSlots`** (`string[]`): Daily briefing hours (e.g. `["08:00", "20:00"]`).
- **`timezone`** (`string`): User local timezone identifier.

### 3. `telegramLinks` Collection
Keyed by 6-digit linking code. Handles user onboarding and Telegram pairing.

---

## Server Storage Reliability & Crash Recovery

### Atomic Write Protocol
To prevent data loss or corruption during sudden server termination:
1. `saveDb()` serializes state and writes to a temporary file `data/local_db.json.tmp`.
2. Uses `fs.renameSync()` to atomically replace `data/local_db.json`.

### Corruption Safeguard
If `data/local_db.json` contains malformed JSON on boot:
1. `loadDb()` catches the parse exception.
2. Creates a timestamped backup copy: `data/local_db.json.corrupt.<timestamp>`.
3. Safely initializes a clean default database structure (`{ userSettings: {}, telegramLinks: {}, tasks: {} }`).
