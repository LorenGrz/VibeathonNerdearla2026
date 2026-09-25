import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvalidSessionTransitionError,
  type EventPublisherPort,
  type Session,
  type SessionId,
  type SessionRepository,
  type SessionRunner,
  type TranscriberPort,
  type TranscriptRepository,
  type TranslatorPort,
} from '@subs/domain';
import type { Env } from '../config/env.js';
import type { ContextualAudioSource } from '../ingest/audio-source-context.js';
import {
  AUDIO_SOURCE,
  EVENT_PUBLISHER,
  SESSION_REPOSITORY,
  TRANSCRIBER,
  TRANSCRIPT_REPOSITORY,
  TRANSLATOR,
} from '../shared/tokens.js';
import { errorMessage, settleWithin, sleep } from './async-utils.js';
import {
  DEFAULT_ORCHESTRATOR_OPTIONS,
  ORCHESTRATOR_OPTIONS,
  backoffDelay,
  type OrchestratorOptions,
} from './orchestrator.options.js';
import { SessionPipeline } from './session-pipeline.js';

const DEFAULT_MAX_SESSIONS = 12;

interface Run {
  readonly session: Session;
  readonly controller: AbortController;
  done: Promise<void>;
}

/**
 * Runs N sessions concurrently in one process. Each running session owns an AbortController and
 * a SessionPipeline; nothing is shared between runs except the (stateless) port adapters.
 * Every status change is followed by `repo.save` + `publisher.publish(session.pullEvents())`.
 */
@Injectable()
export class SessionOrchestrator implements SessionRunner, OnModuleDestroy {
  private readonly logger = new Logger(SessionOrchestrator.name);
  private readonly runs = new Map<string, Run>();
  private readonly options: OrchestratorOptions;
  readonly maxSessions: number;

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepository,
    @Inject(AUDIO_SOURCE) private readonly audio: ContextualAudioSource,
    @Inject(TRANSCRIBER) private readonly transcriber: TranscriberPort,
    @Inject(TRANSLATOR) private readonly translator: TranslatorPort,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisherPort,
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Optional() @Inject(ORCHESTRATOR_OPTIONS) options?: Partial<OrchestratorOptions>,
  ) {
    this.options = { ...DEFAULT_ORCHESTRATOR_OPTIONS, ...options };
    const max = Number(config.get('MAX_SESSIONS', { infer: true }));
    this.maxSessions = Number.isInteger(max) && max > 0 ? max : DEFAULT_MAX_SESSIONS;
  }

  /**
   * idle|stopped|error -> starting, then runs the pipeline in the background (-> live on the
   * first audio chunk). Resolves once `starting` is persisted.
   * @throws NotFoundException unknown session
   * @throws ConflictException already running, invalid transition, or MAX_SESSIONS reached
   */
  async start(id: SessionId): Promise<void> {
    const session = await this.sessions.findById(id);
    if (!session) throw new NotFoundException(`Session ${id.value} not found`);

    // No await between these checks and `runs.set`: concurrent start() calls cannot both pass.
    const key = id.value;
    if (this.runs.has(key)) throw new ConflictException(`Session ${key} is already running`);
    if (this.runs.size >= this.maxSessions) {
      throw new ConflictException(`MAX_SESSIONS (${this.maxSessions}) reached`);
    }
    try {
      session.start();
    } catch (error) {
      if (error instanceof InvalidSessionTransitionError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
    const run: Run = { session, controller: new AbortController(), done: Promise.resolve() };
    this.runs.set(key, run);

    try {
      await this.persist(session);
    } catch (error) {
      this.runs.delete(key);
      throw error;
    }
    run.done = this.supervise(run);
  }

  /**
   * starting|live -> stopped and tears the pipeline down (waits up to `stopTimeoutMs`).
   * Idempotent for sessions that are not running.
   * @throws NotFoundException unknown session
   */
  async stop(id: SessionId): Promise<void> {
    const key = id.value;
    const run = this.runs.get(key);
    if (!run) {
      const session = await this.sessions.findById(id);
      if (!session) throw new NotFoundException(`Session ${key} not found`);
      if (session.status === 'starting' || session.status === 'live') {
        session.stop();
        await this.persist(session);
      }
      return;
    }

    this.runs.delete(key);
    run.controller.abort();
    if (run.session.status === 'starting' || run.session.status === 'live') {
      run.session.stop();
      await this.persist(run.session);
    }
    const settled = await settleWithin(run.done, this.options.stopTimeoutMs);
    if (!settled) {
      this.logger.warn(`[${key}] pipeline did not stop within ${this.options.stopTimeoutMs} ms`);
    }
  }

  isRunning(id: SessionId): boolean {
    return this.runs.has(id.value);
  }

  runningCount(): number {
    return this.runs.size;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.runs.values()].map((run) => this.stop(run.session.id)));
  }

  /** Retry loop around the pipeline. Never rejects. */
  private async supervise(run: Run): Promise<void> {
    const { session, controller } = run;
    const signal = controller.signal;
    const key = session.id.value;
    const pipeline = new SessionPipeline(session, {
      audio: this.audio,
      transcriber: this.transcriber,
      translator: this.translator,
      transcripts: this.transcripts,
      publisher: this.publisher,
      clock: this.options.clock,
      logger: this.logger,
    });
    let failures = 0;

    try {
      while (!signal.aborted) {
        try {
          await pipeline.runOnce(signal, async () => {
            failures = 0; // audio is flowing again: the next failure starts a fresh backoff
            if (!signal.aborted && session.status === 'starting') {
              session.markLive();
              await this.persist(session);
            }
          });
          if (signal.aborted) break;
          // The source ended on its own (e.g. a file finished): the session is over.
          if (session.status === 'starting' || session.status === 'live') {
            session.stop();
            await this.persist(session);
          }
          break;
        } catch (error) {
          if (signal.aborted) break;
          failures += 1;
          const message = errorMessage(error);
          if (failures > this.options.maxRetries) {
            session.fail(`${message} (gave up after ${this.options.maxRetries} retries)`);
            await this.persist(session);
            this.logger.error(`[${key}] failed: ${message}`);
            break;
          }
          const delay = backoffDelay(failures, this.options);
          session.metrics.recordError(message);
          this.logger.warn(
            `[${key}] attempt failed (${failures}/${this.options.maxRetries}): ${message}; retrying in ${delay} ms`,
          );
          await sleep(delay, signal);
        }
      }
    } catch (error) {
      // Only reachable if persisting/publishing a status change throws.
      this.logger.error(`[${key}] supervisor crashed: ${errorMessage(error)}`);
      if (!signal.aborted) {
        session.fail(`orchestrator error: ${errorMessage(error)}`);
        await this.persist(session).catch(() => undefined);
      }
    } finally {
      if (this.runs.get(key) === run) this.runs.delete(key);
    }
  }

  private async persist(session: Session): Promise<void> {
    await this.sessions.save(session);
    const events = session.pullEvents();
    if (events.length > 0) await this.publisher.publish(events);
  }
}
