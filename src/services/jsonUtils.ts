/**
 * Safely extracts and parses JSON content from Model responses,
 * even if the model wrapper contains markdown fences or trailing commas.
 * Never throws but returns a safe default if the raw text is unparsable.
 */
export function extractAndParseJson<T>(text: string, defaultFallback: T): T {
  if (!text) {
    return defaultFallback;
  }

  let cleanText = text.trim();

  // Strip Markdown fences e.g. ```json ... ``` or ``` ... ```
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = fenceRegex.exec(cleanText);
  if (match && match[1]) {
    cleanText = match[1].trim();
  } else {
    // Basic fallback lines removal if start/end matches fences
    if (cleanText.startsWith("```")) {
      const lines = cleanText.split("\n");
      if (lines[0].startsWith("```")) {
        lines.shift();
      }
      if (lines[lines.length - 1].startsWith("```")) {
        lines.pop();
      }
      cleanText = lines.join("\n").trim();
    }
  }

  try {
    return JSON.parse(cleanText) as T;
  } catch (error) {
    console.warn("Standard JSON.parse failed. Applying advanced cleanup.", error);
    try {
      // Remove trailing commas in objects and arrays
      const cleaned = cleanText
        .replace(/,\s*([\]}])/g, "$1") // strip trailing commas before closing braces/brackets
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, ""); // strip comments
      return JSON.parse(cleaned) as T;
    } catch (fallbackError) {
      console.error("Advanced JSON cleanup failed. Returning default fallback.", fallbackError);
      return defaultFallback;
    }
  }
}
