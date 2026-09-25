import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  TRANSCRIBER: z.enum(['live', 'chunked', 'mock']).default('mock'),
  TRANSLATOR: z.enum(['gemini', 'mock']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_LIVE_MODEL: z.string().default('gemini-live-2.5-flash-preview'),
  GEMINI_TEXT_MODEL: z.string().default('gemini-2.5-flash'),
  MAX_SESSIONS: z.coerce.number().int().positive().default(12),
  SAMPLES_DIR: z.string().default('../../samples'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = envSchema.parse(raw);
  const needsGemini = env.TRANSCRIBER !== 'mock' || env.TRANSLATOR === 'gemini';
  if (needsGemini && !env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required unless TRANSCRIBER=mock and TRANSLATOR=mock');
  }
  return env;
}
