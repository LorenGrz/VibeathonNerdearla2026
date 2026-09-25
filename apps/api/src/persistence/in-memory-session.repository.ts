import { Injectable } from '@nestjs/common';
import type { Session, SessionId, SessionRepository } from '@subs/domain';

/** Process-local session store. Returns the same `Session` instances it was given. */
@Injectable()
export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  save(session: Session): Promise<void> {
    this.sessions.set(session.id.value, session);
    return Promise.resolve();
  }

  findById(id: SessionId): Promise<Session | null> {
    return Promise.resolve(this.sessions.get(id.value) ?? null);
  }

  /** Insertion order (creation order for sessions saved on create). */
  findAll(): Promise<Session[]> {
    return Promise.resolve([...this.sessions.values()]);
  }

  delete(id: SessionId): Promise<void> {
    this.sessions.delete(id.value);
    return Promise.resolve();
  }
}
