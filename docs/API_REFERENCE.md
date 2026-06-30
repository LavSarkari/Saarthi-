# 📡 API Reference

> Complete REST & WebSocket API documentation for Saarthi.

[← Back to README](../README.md)

---

## Base URL

```
Development: http://localhost:3000
Production:  https://your-deployed-url.com
```

## Authentication

All API routes support an optional custom Gemini API key via request header:

```
x-gemini-api-key: your_custom_gemini_api_key
```

If not provided, the server's `GEMINI_API_KEY` environment variable is used.

---

## Planning & AI Endpoints

### POST `/api/gemini/task-planner`

Decomposes a commitment into structured subtasks with estimated effort.

**Request Body:**
```json
{
  "commitment": "Study chapters 1-5 of DBMS textbook for exam on Friday",
  "aiContext": "Optional additional context about user's schedule or preferences"
}
```

**Response:**
```json
{
  "title": "DBMS Chapters 1-5 Exam Prep",
  "description": "Comprehensive study plan for database management systems",
  "complexity": "high",
  "totalEffortMinutes": 480,
  "subtasks": [
    {
      "id": "st_1",
      "title": "Read Chapter 1: Introduction to DBMS",
      "estimatedMinutes": 60,
      "order": 1
    }
  ],
  "riskFactors": ["High complexity", "Short deadline"],
  "deadline": "2026-07-04T09:00:00Z"
}
```

---

### POST `/api/gemini/adaptive-schedule`

Generates an adaptive schedule from a set of tasks using a planning strategy.

**Request Body:**
```json
{
  "userId": "user_123",
  "tasks": [...],
  "strategy": "deep_work",
  "maxFocusDuration": 90,
  "preferredStartHour": 9,
  "preferredEndHour": 22
}
```

**Strategy Options:** `balanced`, `deep_work`, `deadline_first`, `energy_optimized`, `recovery_optimized`, `sprint_mode`, `minimal_survival`

---

### POST `/api/gemini/reminder-context`

Generates smart context advice for a specific task — next logical step, resource suggestions, and a draft template.

**Request Body:**
```json
{
  "title": "Write ML research paper",
  "description": "Paper on transformer architectures",
  "deadline": "2026-07-10T23:59:00Z"
}
```

**Response:**
```json
{
  "nextLogicalStep": "Create an outline with 5 sections: Abstract, Intro, Method, Results, Conclusion",
  "contextualAdvice": "Start with the methodology section since you have the most data there",
  "resourceSearchQueries": ["transformer architecture survey 2026", "attention mechanism papers"],
  "draftTemplate": "# Transformer Architecture Analysis\n\n## Abstract\n[Your contribution summary]\n\n## 1. Introduction\n..."
}
```

---

### POST `/api/gemini/analyze-syllabus`

Analyzes a photograph of a syllabus or schedule via Gemini Vision.

**Request Body:**
```json
{
  "imageBase64": "base64_encoded_image_data",
  "mimeType": "image/png"
}
```

---

### POST `/api/gemini/ocr-commitments`

Extracts multiple structured commitments from a syllabus or timetable photograph.

**Request Body:**
```json
{
  "imageBase64": "base64_encoded_image_data",
  "mimeType": "image/jpeg"
}
```

**Response:**
```json
[
  {
    "id": "ocr_1",
    "title": "DBMS Unit Test 1",
    "deadline": "2026-07-15T10:00:00Z",
    "description": "Covers ER diagrams, normalization, SQL basics",
    "estimatedMinutes": 180,
    "confidence": 0.92
  }
]
```

---

## Recovery Endpoints

### POST `/api/gemini/recovery-plan`

Generates an AI recovery plan when execution is failing.

**Request Body:**
```json
{
  "userId": "user_123",
  "mode": "balanced"
}
```

**Mode Options:** `minimal`, `balanced`, `maximum`, `wellness`

**Response:**
```json
{
  "id": "rp_abc123",
  "userId": "user_123",
  "mode": "balanced",
  "situationSummary": {
    "whatHappened": "3 out of 5 tasks have entered the critical zone",
    "why": "Underestimated complexity of ML assignment",
    "message": "This is recoverable. Let's restructure."
  },
  "criticalCommitments": ["ML Assignment", "DBMS Exam"],
  "flexibleCommitments": ["Blog Post", "Side Project"],
  "suggestedTradeoffs": [
    {
      "taskId": "task_3",
      "originalTitle": "Blog Post on React Hooks",
      "proposedAction": "delay",
      "explanation": "Non-critical. Delaying by 1 week frees 3 hours.",
      "newDeadline": "2026-07-14T23:59:00Z",
      "effortSavedMinutes": 180
    }
  ],
  "expectedRecovery": {
    "confidenceBefore": 35,
    "confidenceAfter": 78,
    "timeRecoveredHours": 6.5,
    "stressReductionEstimate": "high"
  },
  "status": "proposed"
}
```

### POST `/api/gemini/execute-recovery`

Applies an accepted recovery plan to all affected tasks.

**Request Body:**
```json
{
  "userId": "user_123",
  "planId": "rp_abc123"
}
```

---

## Chat & Voice Endpoints

### POST `/api/gemini/chat`

Multi-turn AI chat with persona selection, Google Search grounding, and deep thinking mode.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "text": "I'm overwhelmed with my deadlines" },
    { "role": "model", "text": "I understand. Let's break this down..." }
  ],
  "userMessage": "What should I focus on first?",
  "persona": "navigator",
  "enableSearch": false,
  "enableThinking": false,
  "companionProfile": null,
  "appContext": {
    "currentView": "dashboard",
    "tasksCount": 5,
    "riskTasks": 2
  }
}
```

**Persona Options:** `shield` (Procrastination Shield), `navigator` (Calm Strategic Navigator), `coach` (Tough Love Taskmaker)

**Model Selection Logic:**
- Simple queries → `gemini-3.1-flash-lite`
- Complex queries (thinking enabled, search enabled, or >500 chars) → `gemini-3.1-pro-preview`

**Response:**
```json
{
  "text": "Based on your current risk scores, the ML assignment should be your #1 priority...",
  "sources": []
}
```

---

### POST `/api/gemini/tts`

Text-to-Speech synthesis using Gemini TTS.

**Request Body:**
```json
{
  "text": "Great job completing that subtask! You're building momentum.",
  "voice": "Zephyr"
}
```

**Voice Options:** `Puck`, `Charon`, `Kore`, `Fenrir`, `Zephyr`

**Response:**
```json
{
  "audio": "base64_encoded_pcm_audio"
}
```

---

### POST `/api/gemini/generate-image`

AI image generation with cascade fallback strategy.

**Request Body:**
```json
{
  "prompt": "A serene mountain workspace at sunset, minimalist desk with a laptop",
  "size": "1K"
}
```

**Cascade Strategy:**
1. `gemini-3-pro-image-preview` (primary, supports 1K/2K/4K)
2. `gemini-2.5-flash-image` (fallback)
3. Curated Unsplash aesthetics (final fallback — always succeeds)

**Response (Success):**
```json
{
  "imageData": "base64_encoded_image",
  "model": "gemini-3-pro-image-preview"
}
```

**Response (Fallback):**
```json
{
  "imageData": null,
  "imageUrl": "https://images.unsplash.com/...",
  "isFallback": true,
  "warning": "Custom motivation wallpaper compiled matches your visual request!"
}
```

---

### WebSocket `/live`

Real-time voice coaching via Gemini Live API.

**Connection:**
```
ws://localhost:3000/live?userId=user_123&key=optional_api_key
```

**Client → Server Messages:**
```json
// Audio chunk
{ "audio": "base64_encoded_pcm_16khz" }

// Explicit interruption
{ "type": "interrupt" }
```

**Server → Client Messages:**
```json
// Audio response
{ "audio": "base64_encoded_audio" }

// User transcription
{ "type": "userTranscript", "text": "I finished chapter 3" }

// Model transcription
{ "type": "modelTranscript", "text": "Great work! I've updated your progress." }

// User finished speaking signal
{ "type": "userFinishedSpeaking" }

// Task update (from tool call)
{
  "type": "taskUpdated",
  "taskId": "task_1",
  "action": "complete",
  "message": "Subtask 'Read Chapter 3' completed.",
  "tasks": [...]
}

// Interruption signal
{ "interrupted": true }
```

---

## Telegram Endpoints

### POST `/api/telegram/webhook`

Incoming webhook endpoint called by Telegram. Handles messages, commands, and callback queries.

### POST `/api/telegram/generate-code`

Generates a one-time linking code for connecting a Telegram account.

**Request Body:**
```json
{ "userId": "user_123" }
```

**Response:**
```json
{
  "code": "SAR-7X2K",
  "expiresAt": "2026-07-01T10:00:00Z"
}
```

### POST `/api/telegram/unlink`

Removes the Telegram account link.

### POST `/api/telegram/sync-state`

Syncs client-side state (tasks, settings, companion profile) with the server's local database.

**Request Body:**
```json
{
  "userId": "user_123",
  "tasks": [...],
  "userSettings": { "geminiApiKey": "...", "timezone": "Asia/Kolkata" },
  "companionProfile": { "activeCompanion": "guardian", ... }
}
```

### GET `/api/telegram/get-state`

Returns current Telegram linking status and cached task state.

**Query:** `?userId=user_123`

### POST `/api/telegram/trigger-briefing`

Triggers an AI-generated morning or evening briefing via Telegram.

### POST `/api/telegram/trigger-alert`

Triggers a recovery alert for a high-risk task via Telegram.

### GET `/api/telegram/debug`

Returns diagnostic information about the Telegram bot (token status, webhook info, getMe result).

---

## Engagement & Activation Endpoints

### GET `/api/engagement/status`

Returns the user's engagement score, behavioral state, and notification history.

**Query:** `?userId=user_123`

### POST `/api/engagement/quiet-hours`

Configures notification quiet hours.

**Request Body:**
```json
{
  "userId": "user_123",
  "start": "22:00",
  "end": "08:00",
  "enabled": true
}
```

### POST `/api/engagement/overwhelm`

Registers a burnout signal for the user. After 3 signals, the behavioral state transitions to `burned_out`.

### GET `/api/engagement/briefing`

Generates an AI morning/evening briefing calibrated to the user's engagement state.

**Query:** `?userId=user_123&type=morning`

### GET `/api/activation/status`

Returns activation analytics and any currently active micro-mission session.

---

## Error Handling

All API routes return errors in a consistent format:

```json
{
  "error": "Commitment prompt is required.",
  "code": "BAD_REQUEST",
  "status": 400
}
```

| Code | HTTP Status | Description |
|:---|:---|:---|
| `BAD_REQUEST` | 400 | Missing or invalid request parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server-side error |

---

[← Back to README](../README.md) · [Deployment Guide →](DEPLOYMENT.md)
