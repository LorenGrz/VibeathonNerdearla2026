import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { IngestModule } from './ingest/ingest.module.js';
import { OrchestratorModule } from './orchestrator/orchestrator.module.js';
import { PersistenceModule } from './persistence/persistence.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { MockTranscriber } from './transcription/mock.transcriber.js';
import { TranscriptionModule } from './transcription/transcription.module.js';
import { TranslationModule } from './translation/translation.module.js';

/**
 * Composition root: binds every domain port to its adapter.
 * AUDIO_SOURCE <- Ingest · TRANSCRIBER <- Transcription · TRANSLATOR <- Translation
 * EVENT_PUBLISHER <- Realtime · repositories <- Persistence (global) · SESSION_RUNNER <- Orchestrator (global)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PersistenceModule,
    RealtimeModule,
    IngestModule,
    OrchestratorModule.register({
      imports: [
        IngestModule,
        TranscriptionModule.register({ mock: MockTranscriber }),
        TranslationModule,
        RealtimeModule,
      ],
    }),
    SessionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
