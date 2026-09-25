import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { SESSION_RUNNER } from '../shared/tokens.js';
import { ORCHESTRATOR_OPTIONS, type OrchestratorOptions } from './orchestrator.options.js';
import { SessionOrchestrator } from './session-orchestrator.js';

export interface OrchestratorModuleOptions {
  /**
   * Modules that export AUDIO_SOURCE, TRANSCRIBER, TRANSLATOR and EVENT_PUBLISHER.
   * Can be omitted if those providers come from @Global() modules.
   */
  imports?: ModuleMetadata['imports'];
  /** Retry/backoff overrides. */
  options?: Partial<OrchestratorOptions>;
}

/**
 * Provides SESSION_RUNNER (= SessionOrchestrator). Session/transcript repositories come from
 * PersistenceModule. It does NOT provide AUDIO_SOURCE, TRANSCRIBER, TRANSLATOR, EVENT_PUBLISHER
 * and needs ConfigService (MAX_SESSIONS) from a global ConfigModule.
 *
 * Register once in AppModule with `OrchestratorModule.register({ imports: [...] })`; it is global,
 * so SESSION_RUNNER is injectable everywhere.
 */
@Module({
  imports: [PersistenceModule],
  providers: [SessionOrchestrator, { provide: SESSION_RUNNER, useExisting: SessionOrchestrator }],
  exports: [SessionOrchestrator, SESSION_RUNNER],
})
export class OrchestratorModule {
  static register(config: OrchestratorModuleOptions = {}): DynamicModule {
    return {
      module: OrchestratorModule,
      global: true,
      imports: config.imports ?? [],
      providers: [{ provide: ORCHESTRATOR_OPTIONS, useValue: config.options ?? {} }],
    };
  }
}
