/** Request accepted by the small wrapper around the `@google/genai` SDK. */
export interface GeminiTranslationRequest {
  model: string;
  systemInstruction: string;
  prompt: string;
  temperature: number;
  timeoutMs: number;
}

/**
 * Injectable seam around the Gemini text-generation call. Kept minimal so tests can
 * provide a fake instead of exercising the real `@google/genai` client.
 */
export interface GeminiTextClient {
  generateText(request: GeminiTranslationRequest): Promise<string>;
}
