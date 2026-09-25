import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DomainExceptionFilter } from '../shared/domain-exception.filter.js';
import { createTranscriptExporters, TRANSCRIPT_EXPORTERS } from './exporters/index.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

/**
 * Integrator note: `SessionsService` injects `SESSION_REPOSITORY`, `TRANSCRIPT_REPOSITORY`
 * and `SESSION_RUNNER` (see `apps/api/src/shared/tokens.ts`) but does not provide them.
 * The app composition root must make those tokens available to this module — e.g. by
 * importing the persistence module (T3, `SESSION_REPOSITORY`/`TRANSCRIPT_REPOSITORY`) and
 * the orchestrator module (T3, `SESSION_RUNNER`) as `@Global()` modules, or by adding them
 * to `SessionsModule`'s `imports`.
 *
 * This module registers `DomainExceptionFilter` as a global `APP_FILTER`, so importing it
 * anywhere in the app activates the 400/409 mapping for `@subs/domain` errors app-wide.
 */
@Module({
  controllers: [SessionsController],
  providers: [
    SessionsService,
    { provide: TRANSCRIPT_EXPORTERS, useFactory: createTranscriptExporters },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class SessionsModule {}
