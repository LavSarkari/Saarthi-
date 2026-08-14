# API Documentation & Endpoint Reference

## System Health & Diagnostics

### GET `/api/health`
- **Purpose**: System health check endpoint for monitoring uptime and deployment status.
- **Response**:
  ```json
  {
    "status": "ok",
    "uptimeSeconds": 142,
    "version": "1.0.0",
    "timestamp": "2026-08-14T11:55:00.000Z"
  }
  ```

---

## Task & Planning APIs

### POST `/api/gemini/task-planner`
- **Purpose**: Decomposes a raw commitment prompt into time-estimated subtasks.
- **Payload**: `{ "commitment": string, "aiContext"?: object }`
- **Response**: Structured plan JSON containing title, total effort, complexity, and ordered subtasks.

### POST `/api/gemini/adaptive-schedule`
- **Purpose**: Calculates an adaptive schedule based on user tasks, working hours, and planning strategy.
- **Payload**: `{ "userId": string, "tasks": Task[], "strategy": string, "preferredStartHour"?: number, "preferredEndHour"?: number }`
- **Response**: Deterministic schedule object with allocated subtask start and end timestamps.

### POST `/api/gemini/analyze-syllabus`
- **Purpose**: Parses uploaded image files (whiteboards, syllabi) via Gemini Vision.
- **Payload**: `{ "imageBase64": string, "mimeType": string }`
- **Response**: Array of extracted structured task commitments with estimated effort.

---

## Telegram Integration APIs

### POST `/api/telegram/webhook`
- **Purpose**: Receives incoming update webhooks from Telegram servers.
- **Payload**: Standard Telegram Update payload.

### POST `/api/telegram/generate-code`
- **Purpose**: Generates a 6-digit linking code to connect a user's Telegram account.
- **Payload**: `{ "userId": string }`
- **Response**: `{ "code": string, "expiresAt": string }`

### GET `/api/telegram/get-state`
- **Purpose**: Retrieves Telegram linking status and user task cache.
- **Query Params**: `userId=string`
- **Response**: Telegram chat ID, linking status, and associated task list.

### POST `/api/telegram/trigger-briefing`
- **Purpose**: Triggers an on-demand AI morning or evening briefing.
- **Payload**: `{ "userId": string, "chatId": string | number }`

---

## Adaptive Engagement & Activation APIs

### GET `/api/engagement/status`
- **Purpose**: Fetches real-time engagement score and user behavioral state.
- **Query Params**: `userId=string`

### POST `/api/engagement/quiet-hours`
- **Purpose**: Configures notification quiet hours windows.
- **Payload**: `{ "userId": string, "start": string, "end": string, "enabled": boolean }`

### GET `/api/activation/status`
- **Purpose**: Fetches micro-mission activation analytics and active focus sessions.
- **Query Params**: `userId=string`
