import type { AudioSourceSpec, SessionDto, SessionStatus } from '../contracts/dto.js';
import type { DomainEvent } from '../events/domain-event.js';
import {
  SessionFailed,
  SessionLive,
  SessionStarted,
  SessionStopped,
} from '../events/session-events.js';
import { Glossary } from '../glossary/glossary.js';
import type { LanguageCode } from '../language/language-code.js';
import { systemClock, type Clock } from '../shared/clock.js';
import { InvalidArgumentError, InvalidSessionTransitionError } from '../shared/errors.js';
import { randomIdGenerator, type IdGenerator } from '../shared/id-generator.js';
import { SessionId } from './session-id.js';
import { SessionMetrics } from './session-metrics.js';

export type { AudioSourceSpec, SessionStatus } from '../contracts/dto.js';

export interface CreateSessionProps {
  title: string;
  stage: string;
  sourceLanguage: LanguageCode;
  targetLanguages: LanguageCode[];
  source: AudioSourceSpec;
  glossary?: Glossary;
}

export interface SessionDeps {
  clock?: Clock;
  ids?: IdGenerator;
}

const dedupe = (langs: readonly LanguageCode[]): LanguageCode[] =>
  langs.filter((lang, i) => langs.findIndex((other) => other.equals(lang)) === i);

export class Session {
  private _status: SessionStatus = 'idle';
  private _failureReason: string | null = null;
  private events: DomainEvent[] = [];
  private readonly _metrics: SessionMetrics;
  private readonly _targetLanguages: readonly LanguageCode[];

  private constructor(
    readonly id: SessionId,
    readonly title: string,
    readonly stage: string,
    readonly sourceLanguage: LanguageCode,
    targetLanguages: readonly LanguageCode[],
    readonly source: AudioSourceSpec,
    readonly glossary: Glossary,
    readonly createdAt: Date,
    private readonly clock: Clock,
  ) {
    this._targetLanguages = Object.freeze(dedupe(targetLanguages));
    this._metrics = new SessionMetrics(clock);
  }

  static create(props: CreateSessionProps, deps: SessionDeps = {}): Session {
    const clock = deps.clock ?? systemClock;
    const ids = deps.ids ?? randomIdGenerator;
    const title = props.title.trim();
    if (!title) throw new InvalidArgumentError('Session title cannot be empty');
    return new Session(
      SessionId.create(ids),
      title,
      props.stage.trim(),
      props.sourceLanguage,
      props.targetLanguages,
      structuredCloneSource(props.source),
      props.glossary ?? Glossary.empty(),
      clock.now(),
      clock,
    );
  }

  get status(): SessionStatus {
    return this._status;
  }

  get metrics(): SessionMetrics {
    return this._metrics;
  }

  get targetLanguages(): readonly LanguageCode[] {
    return this._targetLanguages;
  }

  /** Reason of the last `fail()`; cleared on `start()`. */
  get failureReason(): string | null {
    return this._failureReason;
  }

  /** idle | stopped | error -> starting */
  start(): void {
    this.assertStatus('start', ['idle', 'stopped', 'error']);
    this._status = 'starting';
    this._failureReason = null;
    this.events.push(new SessionStarted(this.id.value, this.clock.now()));
  }

  /** starting -> live */
  markLive(): void {
    this.assertStatus('mark live', ['starting']);
    this._status = 'live';
    this.events.push(new SessionLive(this.id.value, this.clock.now()));
  }

  /** any -> error */
  fail(reason: string): void {
    this._status = 'error';
    this._failureReason = reason;
    this._metrics.recordError(reason);
    this.events.push(new SessionFailed(this.id.value, this.clock.now(), reason));
  }

  /** starting | live -> stopped */
  stop(): void {
    this.assertStatus('stop', ['starting', 'live']);
    this._status = 'stopped';
    this.events.push(new SessionStopped(this.id.value, this.clock.now()));
  }

  /** Source language first, then targets, without duplicates. */
  languages(): LanguageCode[] {
    return dedupe([this.sourceLanguage, ...this._targetLanguages]);
  }

  pullEvents(): DomainEvent[] {
    const pending = this.events;
    this.events = [];
    return pending;
  }

  toSnapshot(): SessionDto {
    return {
      id: this.id.value,
      title: this.title,
      stage: this.stage,
      sourceLanguage: this.sourceLanguage.value,
      targetLanguages: this._targetLanguages.map((l) => l.value),
      source: structuredCloneSource(this.source),
      status: this._status,
      metrics: this._metrics.snapshot(),
    };
  }

  private assertStatus(action: string, allowed: readonly SessionStatus[]): void {
    if (!allowed.includes(this._status)) {
      throw new InvalidSessionTransitionError(this._status, action);
    }
  }
}

const structuredCloneSource = (source: AudioSourceSpec): AudioSourceSpec => ({ ...source });
