import type { DomainEvent } from './domain-event.js';

export class SessionStarted implements DomainEvent {
  static readonly TYPE = 'session.started';
  readonly type = SessionStarted.TYPE;
  constructor(
    readonly sessionId: string,
    readonly occurredAt: Date,
  ) {}
}

export class SessionLive implements DomainEvent {
  static readonly TYPE = 'session.live';
  readonly type = SessionLive.TYPE;
  constructor(
    readonly sessionId: string,
    readonly occurredAt: Date,
  ) {}
}

export class SessionStopped implements DomainEvent {
  static readonly TYPE = 'session.stopped';
  readonly type = SessionStopped.TYPE;
  constructor(
    readonly sessionId: string,
    readonly occurredAt: Date,
  ) {}
}

export class SessionFailed implements DomainEvent {
  static readonly TYPE = 'session.failed';
  readonly type = SessionFailed.TYPE;
  constructor(
    readonly sessionId: string,
    readonly occurredAt: Date,
    readonly reason: string,
  ) {}
}
