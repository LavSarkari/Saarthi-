# API Documentation

## Endpoints

### POST `/api/generate`
- **Purpose**: Generic endpoint for text generation tasks (task decomposition, recovery plans).
- **Input**: `{ prompt: string }`
- **Output**: `{ response: string }`

### POST `/api/analyze-syllabus`
- **Purpose**: Analyzes a syllabus or document using Gemini Vision to extract deadlines and requirements.
- **Input**: Form data with image files and prompt.
- **Output**: JSON containing an array of structured tasks.

### GET `/api/telegram/trigger-alert`
- **Purpose**: Triggers a high-priority Telegram alert when a task enters a critical state.
- **Input**: Query parameters with task details.
- **Output**: Success confirmation.

## Authentication
Currently, the backend APIs do not require user-specific authentication tokens since they only act as proxies to Gemini. However, in a full production environment, Firebase Auth tokens should be validated on the backend.
