import { Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  captionRoom,
  LanguageCode,
  SessionId,
  WS_NAMESPACE_CAPTIONS,
  type CaptionsClientEvents,
  type SessionRepository,
  type TranscriptRepository,
} from '@subs/domain';
import type { Server, Socket } from 'socket.io';
import { SESSION_REPOSITORY, TRANSCRIPT_REPOSITORY } from '../shared/tokens.js';

const HISTORY_SIZE = 20;

/**
 * Requires `SESSION_REPOSITORY` and `TRANSCRIPT_REPOSITORY` to be available in this
 * module's injector context (see `RealtimeModule` for the integrator note).
 */
@WebSocketGateway({ namespace: WS_NAMESPACE_CAPTIONS, cors: { origin: true, credentials: true } })
export class CaptionsGateway {
  @WebSocketServer() server!: Server;

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepository,
  ) {}

  @SubscribeMessage('captions:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CaptionsClientEvents['captions:join'],
  ): Promise<void> {
    try {
      const sessionId = SessionId.of(payload.sessionId);
      const language = LanguageCode.of(payload.language);
      const session = await this.sessions.findById(sessionId);
      if (!session) {
        client.emit('captions:error', { message: `Session ${payload.sessionId} not found` });
        return;
      }
      void client.join(captionRoom(sessionId.value, language.value));
      const transcript = await this.transcripts.get(sessionId);
      const history = transcript
        .forLanguage(language)
        .slice(-HISTORY_SIZE)
        .map((segment) => segment.toDto());
      client.emit('captions:history', history);
      client.emit('session:status', { id: sessionId.value, status: session.status });
    } catch (error) {
      client.emit('captions:error', {
        message: error instanceof Error ? error.message : 'Invalid captions:join payload',
      });
    }
  }

  @SubscribeMessage('captions:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CaptionsClientEvents['captions:leave'],
  ): void {
    void client.leave(captionRoom(payload.sessionId, payload.language));
  }
}
