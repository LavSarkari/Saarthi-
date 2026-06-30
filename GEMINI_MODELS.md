# 🧠 Gemini Model Selection Strategy

> Documentation on Saarthi's usage of the Google Gemini ecosystem.

[← Back to README](../README.md)

---

## Overview

Saarthi is built entirely around the Google Gemini API. It does not use a single model for everything; instead, it dynamically routes tasks to specific models based on **latency, cost, reasoning complexity, and required modalities**.

All API calls flow through a unified utility (`geminiCall.ts`) that handles exponential backoff, JSON parsing, and fallback cascading.

---

## Model Matrix

| Task | Selected Model | Why this model? |
|:---|:---|:---|
| **Chat (Simple)** | `gemini-3.1-flash-lite` | Highest speed, lowest latency for conversational flow. |
| **Chat (Complex)** | `gemini-3.1-pro-preview` | Deep reasoning for recovery planning. Supports `ThinkingLevel.HIGH`. |
| **Search Grounding** | `gemini-3.1-pro-preview` | Best at integrating live web results via Google Search tool. |
| **Task Decomposition** | `gemini-3.1-flash-lite` | Excellent at structured JSON generation via `responseSchema`. |
| **Micro Missions** | `gemini-3.1-flash-lite` | Extremely fast (sub-second) for breaking execution paralysis instantly. |
| **Briefings / Reflections**| `gemini-3.5-flash` | Superior emotional intelligence and natural language phrasing for empathy. |
| **Syllabus OCR** | `gemini-3.1-flash-lite` | Fast vision processing, great at tabular/image-to-JSON extraction. |
| **Voice Coaching** | `gemini-3.1-flash-live-preview` | Exclusively supports the bidirectional WebSocket Live API. |
| **Text-to-Speech** | `gemini-3.1-flash-tts-preview` | Native TTS generation with built-in voice models (Zephyr, Puck, etc). |
| **Image Generation** | `gemini-3-pro-image-preview` | Highest resolution (1K/2K/4K) for aesthetic motivation wallpapers. |
| **Image Fallback** | `gemini-2.5-flash-image` | High-speed fallback if Pro quotas are exceeded. |

---

## Advanced Capabilities Used

### 1. Structured JSON Output

For deterministic system tasks (Planning, OCR, Recovery), Saarthi heavily utilizes `responseSchema`.

```typescript
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    estimatedMinutes: { type: Type.INTEGER }
  },
  required: ["title", "estimatedMinutes"]
};

// Forces the model to return strict, parseable JSON
config: {
  responseMimeType: "application/json",
  responseSchema
}
```

### 2. High Thinking Mode

For complex strategic advice or when the user persona requires deep analysis (e.g., "Strategist" companion), Saarthi routes the prompt to Gemini Pro with `ThinkingLevel.HIGH`:

```typescript
if (enableThinking) {
  selectedModel = "gemini-3.1-pro-preview";
  config.thinkingConfig = {
    thinkingLevel: ThinkingLevel.HIGH,
  };
}
```

### 3. Tool Calling (Function Calling)

Gemini Live Voice uses Tool Calling to modify the database mid-conversation.

```typescript
tools: [{
  functionDeclarations: [{
    name: "completeTask",
    description: "Mark a specific task as completed.",
    parameters: {
      type: Type.OBJECT,
      properties: { taskId: { type: Type.STRING } }
    }
  }]
}]
```

When Gemini decides a task is done based on user speech, it pauses, issues the tool call to the Node.js server, waits for the server to update Firestore, and then verbally confirms the success.

### 4. Cascade Fallback Strategy

Image generation pipelines are fragile due to quotas or safety blocks. Saarthi uses a 3-tier cascade:

1. Try `gemini-3-pro-image-preview` (Best quality)
2. *On Fail:* Try `gemini-2.5-flash-image` (Fast fallback)
3. *On Fail:* Return curated Unsplash URL based on prompt keywords (Guaranteed success)

---

## Cost Optimization

By aggressively routing standard UI operations (Task generation, Micro-missions) to `gemini-3.1-flash-lite`, Saarthi minimizes API costs by up to 90% compared to using Pro models universally.

Pro models are reserved **exclusively** for explicit user opt-in features:
- Toggling "Deep Thinking" in chat
- Toggling "Web Search" in chat
- High-stakes Recovery OS generation

---

[← Back to README](../README.md) · [Behavioral Engine →](BEHAVIORAL_ENGINE.md)
