import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import {
  SessionId,
  WS_NAMESPACE_MIC,
  type MicClientEvents,
  type SessionRepository,
} from '@subs/domain';
import type { Socket } from 'socket.io';
import { SESSION_REPOSITORY } from '../shared/tokens.js';
import { MicAudioSource } from './mic-audio-source.js';

/** Server -> client events of `/mic` (api/web local; the domain only models client events). */
export interface MicServerEvents {
  'mic:started': { sessionId: string };
  'mic:stopped': { sessionId: string };
  'mic:error': { message: string };
}

interface MicSocketData {
  sessionId?: string;
}

/** socket.io delivers binary payloads as `Buffer` in Node; accept any binary shape defensively. */
function toBytes(payload: unknown): Uint8Array | null {
  if (payload instanceof Uint8Array) return payload;
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  if (ArrayBuffer.isView(payload)) {
    return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  }
  return null;
}

/**
 * `/mic`: a browser claims a `mic` session with `mic:start`, streams Int16 PCM 16 kHz mono with
 * binary `mic:chunk` and releases it with `mic:stop` (or by disconnecting). One emitter per
 * session; the second one gets `mic:error`.
 */
@WebSocketGateway({ namespace: WS_NAMESPACE_MIC, cors: { origin: true, credentials: true } })
export class MicGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(MicGateway.name);

  constructor(
    @Inject(MicAudioSource) private readonly mic: MicAudioSource,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  @SubscribeMessage('mic:start')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MicClientEvents['mic:start'] | undefined,
  ): Promise<void> {
    const rawId = payload?.sessionId;
    if (typeof rawId !== 'string' || rawId.length === 0) {
      this.fail(client, 'mic:start requires { sessionId }');
      return;
    }
    let sessionId: SessionId;
    try {
      sessionId = SessionId.of(rawId);
    } catch (error) {
      this.fail(client, error instanceof Error ? error.message : 'Invalid session id');
      return;
    }
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      this.fail(client, `Session ${rawId} not found`);
      return;
    }
    if (session.source.kind !== 'mic') {
      this.fail(client, `Session ${rawId} does not use a microphone source`);
      return;
    }

    const data = client.data as MicSocketData;
    if (data.sessionId && data.sessionId !== sessionId.value) {
      this.mic.release(data.sessionId, client.id); // one socket feeds one session at a time
    }
    if (!this.mic.claim(sessionId.value, client.id)) {
      data.sessionId = undefined;
      this.fail(client, `Session ${rawId} already has an active microphone`);
      return;
    }
    data.sessionId = sessionId.value;
    client.emit('mic:started', { sessionId: sessionId.value });
  }

  @SubscribeMessage('mic:chunk')
  handleChunk(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown): void {
    const sessionId = (client.data as MicSocketData).sessionId;
    if (!sessionId) return; // not claimed (or rejected): drop silently, the client got mic:error
    const bytes = toBytes(payload);
    if (!bytes) {
      this.fail(client, 'mic:chunk must be a binary ArrayBuffer');
      return;
    }
    this.mic.push(sessionId, client.id, bytes);
  }

  @SubscribeMessage('mic:stop')
  handleStop(@ConnectedSocket() client: Socket): void {
    const data = client.data as MicSocketData;
    if (!data.sessionId) return;
    const sessionId = data.sessionId;
    this.mic.release(sessionId, client.id);
    data.sessionId = undefined;
    client.emit('mic:stopped', { sessionId });
  }

  handleDisconnect(client: Socket): void {
    const sessionId = (client.data as MicSocketData | undefined)?.sessionId;
    if (sessionId) this.mic.release(sessionId, client.id);
  }

  private fail(client: Socket, message: string): void {
    this.logger.warn(`[mic ${client.id}] ${message}`);
    client.emit('mic:error', { message });
  }
}
