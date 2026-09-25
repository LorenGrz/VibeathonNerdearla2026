export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
  readonly sessionId: string;
}
