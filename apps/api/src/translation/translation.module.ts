import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TranslatorPort } from '@subs/domain';
import type { Env } from '../config/env.js';
import { TRANSLATOR } from '../shared/tokens.js';
import { GoogleGenAiTextClient } from './gemini-text-client.js';
import { GeminiTranslator } from './gemini-translator.js';
import { MockTranslator } from './mock-translator.js';

export interface TranslationEnv {
  translator: Env['TRANSLATOR'];
  geminiApiKey: string | undefined;
  geminiTextModel: string;
}

/** Picks the `TranslatorPort` implementation from `env.translator` (`gemini` | `mock`). */
export function createTranslator(env: TranslationEnv): TranslatorPort {
  if (env.translator !== 'gemini') {
    return new MockTranslator();
  }
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required when TRANSLATOR=gemini');
  }
  return new GeminiTranslator(new GoogleGenAiTextClient(env.geminiApiKey), env.geminiTextModel);
}

@Module({
  providers: [
    {
      provide: TRANSLATOR,
      useFactory: (config: ConfigService<Env, true>): TranslatorPort =>
        createTranslator({
          translator: config.get('TRANSLATOR', { infer: true }),
          geminiApiKey: config.get('GEMINI_API_KEY', { infer: true }),
          geminiTextModel: config.get('GEMINI_TEXT_MODEL', { infer: true }),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [TRANSLATOR],
})
export class TranslationModule {}
