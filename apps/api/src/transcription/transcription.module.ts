/**
 * Provides the `TRANSCRIBER` token, chosen by the `TRANSCRIBER` env var:
 *   live    -> GeminiLiveTranscriber   (GEMINI_LIVE_MODEL, GEMINI_API_KEY)
 *   chunked -> GeminiChunkedTranscriber (GEMINI_TEXT_MODEL, GEMINI_API_KEY)
 *   mock    -> the class passed as `mock` (T3's MockTranscriber), built with ModuleRef.create
 *
 * Integrator wiring (app.module.ts; ConfigModule is already global):
 *   import { MockTranscriber } from './transcription/mock.transcriber.js';
 *   imports: [..., TranscriptionModule.register({ mock: MockTranscriber })]
 * Then inject with `@Inject(TRANSCRIBER) transcriber: TranscriberPort`.
 */
import { Logger, Module, type DynamicModule, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { TranscriberPort } from '@subs/domain';
import type { Env } from '../config/env.js';
import { TRANSCRIBER } from '../shared/tokens.js';
import {
  createGeminiContentClient,
  createGeminiLiveClient,
  createGoogleGenAI,
} from './gemini.client.js';
import { GeminiChunkedTranscriber } from './gemini-chunked.transcriber.js';
import { DEFAULT_GEMINI_LIVE_MODEL, GeminiLiveTranscriber } from './gemini-live.transcriber.js';

export interface TranscriptionModuleOptions {
  /** Transcriber used when TRANSCRIBER=mock (e.g. `MockTranscriber` from './mock.transcriber.js'). */
  mock?: Type<TranscriberPort>;
}

/** Live model ids already shut down by Google (see Gemini "deprecations" page). */
const SHUT_DOWN_LIVE_MODELS = new Set([
  'gemini-live-2.5-flash-preview',
  'gemini-2.0-flash-live-001',
]);

export function resolveLiveModel(configured: string, logger?: Pick<Logger, 'warn'>): string {
  if (!SHUT_DOWN_LIVE_MODELS.has(configured)) return configured;
  logger?.warn(
    `GEMINI_LIVE_MODEL=${configured} has been shut down; using ${DEFAULT_GEMINI_LIVE_MODEL}`,
  );
  return DEFAULT_GEMINI_LIVE_MODEL;
}

export async function createTranscriber(
  config: ConfigService<Env, true>,
  moduleRef: ModuleRef,
  options: TranscriptionModuleOptions,
): Promise<TranscriberPort> {
  const kind = config.get('TRANSCRIBER', { infer: true });
  const logger = new Logger(TranscriptionModule.name);

  if (kind === 'mock') {
    // MOCK BRANCH: the class comes from T3 (./mock.transcriber.js) via register({ mock }).
    if (!options.mock) {
      throw new Error(
        'TRANSCRIBER=mock but no mock transcriber was registered: use TranscriptionModule.register({ mock: MockTranscriber })',
      );
    }
    return moduleRef.create(options.mock);
  }

  const apiKey = config.get('GEMINI_API_KEY', { infer: true });
  if (!apiKey) throw new Error(`GEMINI_API_KEY is required for TRANSCRIBER=${kind}`);
  const ai = createGoogleGenAI(apiKey);

  if (kind === 'live') {
    const model = resolveLiveModel(config.get('GEMINI_LIVE_MODEL', { infer: true }), logger);
    logger.log(`Transcriber: Gemini Live (${model})`);
    return new GeminiLiveTranscriber(createGeminiLiveClient(ai), { model });
  }

  const model = config.get('GEMINI_TEXT_MODEL', { infer: true });
  logger.log(`Transcriber: Gemini chunked (${model})`);
  return new GeminiChunkedTranscriber(createGeminiContentClient(ai), { model });
}

@Module({})
export class TranscriptionModule {
  static register(options: TranscriptionModuleOptions = {}): DynamicModule {
    return {
      module: TranscriptionModule,
      providers: [
        {
          provide: TRANSCRIBER,
          inject: [ConfigService, ModuleRef],
          useFactory: (config: ConfigService<Env, true>, moduleRef: ModuleRef) =>
            createTranscriber(config, moduleRef, options),
        },
      ],
      exports: [TRANSCRIBER],
    };
  }
}
