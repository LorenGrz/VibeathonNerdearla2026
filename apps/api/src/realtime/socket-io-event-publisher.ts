import { Inject, Injectable } from '@nestjs/common';
import {
  captionRoom,
  SegmentTranscribed,
  SegmentTranslated,
  SessionFailed,
  SessionId,
  SessionLive,
  SessionStarted,
  SessionStopped,
  type DomainEvent,
  type EventPublisherPort,
  type SessionDto,
  type SessionRepository,
} from '@subs/domain';
import { SESSION_REPOSITORY } from '../shared/tokens.js';
import { CaptionsGateway } from './captions.gateway.js';

/**
 * Bridges domain events to Socket.IO: segment events go to the caption room for their
 * language; session status changes go to every language room of that session.
 * Requires `SESSION_REPOSITORY` to be available in this module's injector context.
 */
@Injectable()
export class SocketIoEventPublisher implements EventPublisherPort {
  constructor(
    private readonly captionsGateway: CaptionsGateway,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.handle(event);
    }
  }

  private async handle(event: DomainEvent): Promise<void> {
    if (event instanceof SegmentTranscribed || event instanceof SegmentTranslated) {
      const dto = event.segment.toDto();
      const room = captionRoom(dto.sessionId, dto.language);
      this.captionsGateway.server.to(room).emit('caption', dto);
      return;
    }
    if (
      event instanceof SessionStarted ||
      event instanceof SessionLive ||
      event instanceof SessionStopped ||
      event instanceof SessionFailed
    ) {
      await this.broadcastStatus(event.sessionId);
    }
  }

  private async broadcastStatus(sessionId: string): Promise<void> {
    const session = await this.sessions.findById(SessionId.of(sessionId));
    if (!session) return;
    const payload: Pick<SessionDto, 'id' | 'status'> = { id: sessionId, status: session.status };
    for (const language of session.languages()) {
      const room = captionRoom(sessionId, language.value);
      this.captionsGateway.server.to(room).emit('session:status', payload);
    }
  }
}
