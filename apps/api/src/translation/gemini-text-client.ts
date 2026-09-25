import { GoogleGenAI } from '@google/genai';
import type { GeminiTextClient, GeminiTranslationRequest } from './gemini-client.js';

/** Real `GeminiTextClient` backed by the `@google/genai` SDK. */
export class GoogleGenAiTextClient implements GeminiTextClient {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateText(request: GeminiTranslationRequest): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: request.model,
      contents: request.prompt,
      config: {
        systemInstruction: request.systemInstruction,
        temperature: request.temperature,
        httpOptions: { timeout: request.timeoutMs },
      },
    });
    const text = response.text;
    if (text === undefined) {
      throw new Error('Gemini returned an empty translation');
    }
    return text;
  }
}
