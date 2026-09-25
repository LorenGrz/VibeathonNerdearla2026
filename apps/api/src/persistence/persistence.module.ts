import { Module } from '@nestjs/common';
import { SESSION_REPOSITORY, TRANSCRIPT_REPOSITORY } from '../shared/tokens.js';
import { InMemorySessionRepository } from './in-memory-session.repository.js';
import { InMemoryTranscriptRepository } from './in-memory-transcript.repository.js';

/**
 * Binds the repository ports to in-memory adapters. Nest instantiates a static module once,
 * so every importer shares the same repositories.
 */
@Module({
  providers: [
    { provide: SESSION_REPOSITORY, useClass: InMemorySessionRepository },
    { provide: TRANSCRIPT_REPOSITORY, useClass: InMemoryTranscriptRepository },
  ],
  exports: [SESSION_REPOSITORY, TRANSCRIPT_REPOSITORY],
})
export class PersistenceModule {}
