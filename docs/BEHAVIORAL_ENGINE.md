# 🧠 Behavioral Intelligence Engine

> Deep dive into how Saarthi tracks, learns, and adapts to user behavior.

[← Back to README](../README.md)

---

## Overview

Traditional productivity apps assume you are a perfectly rational robot. Saarthi's Behavioral Intelligence Engine observes how you *actually* work, builds a private **Learning Profile**, and uses those insights to optimize future AI planning and emotional interventions.

---

## 1. Behavioral Events

Every significant action taken in the app generates a `BehavioralEvent` recorded in Firestore.

### Event Types Tracked

| Category | Events | What it tells the system |
|:---|:---|:---|
| **Task Lifecycle** | `TASK_CREATED`, `TASK_STARTED`, `TASK_COMPLETED`, `TASK_FAILED`, `TASK_SNOOZED`, `TASK_DELETED` | Execution velocity, procrastination delays, estimation accuracy |
| **Recovery** | `RECOVERY_ACCEPTED`, `RECOVERY_REJECTED` | Willingness to compromise scope when behind |
| **Communication** | `TELEGRAM_REPLY`, `TELEGRAM_IGNORE`, `VOICE_CONVERSATION` | Preferred interaction channels and response rates |
| **Focus** | `FOCUS_SESSION_STARTED`, `FOCUS_SESSION_COMPLETED` | True stamina (average focus duration before breaking) |
| **Activation** | `ACTIVATION_STARTED`, `ACTIVATION_COMPLETED`, `ACTIVATION_ABANDONED` | Susceptibility to executive dysfunction and micro-mission efficacy |

---

## 2. The Learning Profile

The `behavioralIntelligenceService` aggregates these raw events into the **Learning Profile**. This profile contains learned attributes, each with a confidence score based on the volume of evidence.

### Key Learned Attributes

- **`preferredWorkHours`**: When does the user actually complete tasks? (e.g., "21:00-01:00")
- **`averageFocusDurationMinutes`**: Used by the Planner to chunk tasks appropriately (e.g., if user burns out after 45m, the AI stops planning 90m blocks).
- **`averageEstimationErrorPercent`**: If a user routinely takes 2x longer than they estimate, the AI silently pads future task estimations.
- **`mostDelayedSubject`**: Identifies specific categories (e.g., "Math") that trigger avoidance behavior.
- **`averageProcrastinationDelayDays`**: How long a task usually sits before being started.

---

## 3. The Engagement Engine

The `engagementService` acts as the real-time emotional state tracker.

### The Score (0-100)
Every interaction (button press, focus session, Telegram reply) increases the score.
Every 24 hours of inactivity decays the score by 8 points.

### Behavioral States
The score and external signals map deterministically to 6 states:

1. **`highly_engaged`** (Score ≥ 85)
2. **`building_momentum`** (Score 55-84)
3. **`passive`** (Score 30-54)
4. **`overwhelmed`** (Score < 30)
5. **`burned_out`** (Triggered by 3+ explicit overload signals)
6. **`deadline_crisis`** (Triggered if any task enters the Critical Risk Zone)

---

## 4. Companion Auto-Adaptation

The AI companion doesn't just read the state; it **adapts its personality** (`companionEngine.ts`).

- **Scenario 1:** User is using the "Commander" persona (tough love) but enters the `overwhelmed` state.
  - *System Action:* Auto-switches persona to "Guardian" (supportive), changes motivation style to "gentle", and reduces pressure tolerance to "low".
  
- **Scenario 2:** User ignores 3 Telegram notifications in a row.
  - *System Action:* Auto-reduces `communicationDensity` from high to medium. Engages notification back-off lock for 6 hours.

- **Scenario 3:** User completes 5 micro-missions consecutively.
  - *System Action:* Increases momentum score, logs "building momentum", and AI briefings switch tone from "just start" to "maintain the streak".

---

## 5. Privacy Guarantee

All behavioral data, events, and learning profiles are strictly tied to the individual `userId` and secured via Firestore rules. Saarthi uses this data **exclusively** to format the context window for the user's own Gemini calls. It is never used to train generalized models.

---

[← Back to README](../README.md)
