import { io, type Socket } from 'socket.io-client';
import { WS_NAMESPACE_CAPTIONS } from '@subs/domain';
import type { CaptionsClientEvents, CaptionsServerEvents, LanguageCodeValue } from '@subs/domain';
import { getApiBaseUrl } from '@/lib/api';

/**
 * `@subs/domain` models WS events as `{ eventName: PayloadType }` (transport-agnostic).
 * socket.io-client's `EventsMap` expects `{ eventName: (payload: PayloadType) => void }`.
 * This maps one to the other without touching the domain contracts.
 */
type AsListenerMap<T> = { [K in keyof T]: (payload: T[K]) => void };

export type CaptionsSocket = Socket<
  AsListenerMap<CaptionsServerEvents>,
  AsListenerMap<CaptionsClientEvents>
>;

export function connectCaptionsSocket(): CaptionsSocket {
  return io(`${getApiBaseUrl()}${WS_NAMESPACE_CAPTIONS}`, {
    transports: ['websocket'],
    reconnection: true,
  });
}

export function joinCaptionsRoom(
  socket: CaptionsSocket,
  sessionId: string,
  language: LanguageCodeValue,
): void {
  socket.emit('captions:join', { sessionId, language });
}

export function leaveCaptionsRoom(
  socket: CaptionsSocket,
  sessionId: string,
  language: LanguageCodeValue,
): void {
  socket.emit('captions:leave', { sessionId, language });
}
