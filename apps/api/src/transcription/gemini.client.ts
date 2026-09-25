/**
 * Thin seams over `@google/genai` (v2.24) so the transcribers can be tested with fakes.
 *
 * Verified against the installed typings (dist/genai.d.ts) and the Gemini docs (2026-09-25):
 * - `ai.live.connect({ model, config, callbacks })` resolves to a `Session` once the socket opens.
 * - `session.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } })`,
 *   `session.sendRealtimeInput({ audioStreamEnd: true })`, `session.close()`.
 * - `LiveServerMessage.serverContent.interimInputTranscription` = low-latency partial hypothesis,
 *   `serverContent.inputTranscription` = finalized transcript (`Transcription { text, finished }`).
 * - `LiveServerMessage.goAway.timeLeft` announces the connection is about to be dropped
 *   (connections last ~10 min; `gemini-3.5-transcribe-live` sessions stream up to 10 min).
 * - `LiveConnectConfig.sessionResumption: { handle }` + `sessionResumptionUpdate.newHandle`.
 *   `transparent: true` throws in Gemini Developer API mode, so it is never sent.
 */
import {
  GoogleGenAI,
  type GenerateContentParameters,
  type LiveConnectConfig,
  type LiveSendRealtimeInputParameters,
  type LiveServerMessage,
} from '@google/genai';

/** The subset of `LiveServerMessage` the transcriber reads (plain object friendly for fakes). */
export type GeminiLiveMessage = Pick<
  LiveServerMessage,
  'serverContent' | 'goAway' | 'sessionResumptionUpdate'
>;

export interface GeminiLiveCallbacks {
  onmessage(message: GeminiLiveMessage): void;
  onerror(error: Error): void;
  onclose(event: { code?: number; reason?: string }): void;
}

export interface GeminiLiveSession {
  sendRealtimeInput(params: LiveSendRealtimeInputParameters): void;
  close(): void;
}

export interface GeminiLiveConnectParams {
  model: string;
  config: LiveConnectConfig;
  callbacks: GeminiLiveCallbacks;
}

export interface GeminiLiveClient {
  connect(params: GeminiLiveConnectParams): Promise<GeminiLiveSession>;
}

export interface GeminiContentClient {
  generateContent(params: GenerateContentParameters): Promise<{ text: string | undefined }>;
}

export function createGoogleGenAI(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

export function createGeminiLiveClient(ai: GoogleGenAI): GeminiLiveClient {
  return {
    connect: ({ model, config, callbacks }) =>
      ai.live.connect({
        model,
        config,
        callbacks: {
          onmessage: (message) => callbacks.onmessage(message),
          onerror: (event: unknown) => callbacks.onerror(toError(event)),
          onclose: (event: unknown) => callbacks.onclose(toCloseInfo(event)),
        },
      }),
  };
}

export function createGeminiContentClient(ai: GoogleGenAI): GeminiContentClient {
  return {
    generateContent: async (params) => {
      const response = await ai.models.generateContent(params);
      return { text: response.text };
    },
  };
}

function toError(event: unknown): Error {
  if (event instanceof Error) return event;
  if (typeof event === 'object' && event !== null) {
    const { error, message } = event as { error?: unknown; message?: unknown };
    if (error instanceof Error) return error;
    if (typeof message === 'string' && message) return new Error(message);
  }
  return new Error('Gemini Live connection error');
}

function toCloseInfo(event: unknown): { code?: number; reason?: string } {
  if (typeof event !== 'object' || event === null) return {};
  const { code, reason } = event as { code?: unknown; reason?: unknown };
  return {
    code: typeof code === 'number' ? code : undefined,
    reason: typeof reason === 'string' ? reason : undefined,
  };
}
