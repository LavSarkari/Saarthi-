# AI Capabilities & Orchestration

Saarthi is built entirely around Google's Gemini AI ecosystem. It leverages multiple specialized models to handle different cognitive tasks.

## Gemini Models Used

### 1. Gemini 2.5 Flash
**Purpose:** High-speed reasoning, task decomposition, and NLP routing.
- **Task Decomposition:** Transforms raw goals into logical subtasks with minute-level execution estimates using JSON schema constraints.
- **Recovery Engine:** Analyzes schedule conflicts and generates strategic compromise strategies.
- **Telegram Routing:** Analyzes incoming text messages and routes them to the correct backend function (e.g., status check, snooze task).

### 2. Gemini 2.5 Flash Vision
**Purpose:** Autonomous document processing.
- **Syllabus Parsing:** Scans images of syllabi, whiteboards, or assignments to extract deadlines, calculate time estimates, and generate structured commitments dynamically.

### 3. Gemini Live API (WebSockets)
**Purpose:** Low-latency conversational coaching.
- **Voice Assistant:** Users can brainstorm or dictate updates in real-time. The Live API is provided context of their current `tasks` and can trigger server-side function calling (e.g., `completeTask` or `snoozeTask`) directly through voice commands.

### 4. Gemini TTS Preview
**Purpose:** Voice generation.
- **Voice Output:** Synthesizes spoken feedback during the Assistant interaction loop and provides high-quality auditory responses for the live conversational agent.

## Prompt Orchestration & Structured Outputs
To ensure reliability, the Express backend utilizes the `@google/genai` SDK's `responseSchema` capabilities to enforce strict JSON returns from Gemini 2.5 Flash. This allows the React frontend to seamlessly map AI responses into interactive UI elements without risking string parsing errors.
