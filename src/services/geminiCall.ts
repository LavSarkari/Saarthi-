import { GoogleGenAI } from "@google/genai";

export interface GenerateContentOptions {
  model: string;
  contents: any;
  config?: any;
}

/**
 * A robust wrapper for generating content via the Gemini API.
 * Resolves the following challenges:
 * 1. Automatic model fallback (e.g., gemini-3.1-pro-preview -> gemini-3.1-flash-lite) on 429/503/any error.
 * 2. Automatic retries with exponential backoff on transient errors (503 / 429).
 */
export async function generateContentWithRetryAndFallback(
  aiClient: GoogleGenAI,
  options: GenerateContentOptions,
  maxRetries = 2,
  delayMs = 1000
): Promise<any> {
  const { model, contents, config } = options;
  let currentModel = model;
  let currentConfig = config ? { ...config } : {};

  let attempts = 0;
  while (true) {
    try {
      return await aiClient.models.generateContent({
        model: currentModel,
        contents,
        config: currentConfig,
      });
    } catch (error: any) {
      attempts++;
      const errorMessage = error?.message || String(error);
      const errorStatus = error?.status || "";
      const errorCode = error?.code || error?.statusCode || 0;

      const isRateLimitOrTransient = 
        errorCode === 429 || 
        errorCode === 503 ||
        errorStatus === "RESOURCE_EXHAUSTED" ||
        errorStatus === "UNAVAILABLE" ||
        errorMessage.includes("quota") ||
        errorMessage.includes("demand") ||
        errorMessage.includes("rate-limits") ||
        errorMessage.includes("UNAVAILABLE") ||
        errorMessage.includes("503") ||
        errorMessage.includes("429");

      console.warn(
        `Gemini call failed (attempt ${attempts}/${maxRetries + 1}) for model ${currentModel}. Error: ${errorMessage}. Status: ${errorStatus}. Code: ${errorCode}`
      );

      // If it's a complex model and it failed, immediately fallback to gemini-3.1-flash-lite
      if (currentModel === "gemini-3.1-pro-preview" || currentModel === "gemini-2.5-flash") {
        console.warn(`Falling back from ${currentModel} to gemini-3.1-flash-lite due to error.`);
        currentModel = "gemini-3.1-flash-lite";
        // Remove thinking config as gemini-3.1-flash-lite doesn't need/support it or to avoid extra quota usage
        if (currentConfig.thinkingConfig) {
          delete currentConfig.thinkingConfig;
        }
        // Reset attempts to give the fallback model a fresh set of retries
        attempts = 0;
        continue;
      }

      if (attempts > maxRetries) {
        throw error;
      }

      // If it's a rate limit or transient error, wait and retry
      if (isRateLimitOrTransient) {
        const backoff = delayMs * Math.pow(2, attempts - 1);
        console.log(`Waiting ${backoff}ms before retrying Gemini API call...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        // For non-transient errors, throw immediately to fail fast
        throw error;
      }
    }
  }
}
