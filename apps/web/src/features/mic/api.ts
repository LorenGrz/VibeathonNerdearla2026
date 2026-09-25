import { io, type Socket } from 'socket.io-client';
import { WS_NAMESPACE_MIC } from '@subs/domain';
import type { MicClientEvents } from '@subs/domain';
import { getApiBaseUrl } from '@/lib/api';

/** Server -> client events of `/mic` (mirrors `MicServerEvents` in apps/api mic.gateway.ts). */
export interface MicServerEvents {
  'mic:started': { sessionId: string };
  'mic:stopped': { sessionId: string };
  'mic:error': { message: string };
}

/** Maps `{ event: Payload }` contracts to socket.io-client listener maps (see captions/api.ts). */
type AsListenerMap<T> = { [K in keyof T]: (payload: T[K]) => void };

export type MicSocket = Socket<AsListenerMap<MicServerEvents>, AsListenerMap<MicClientEvents>>;

/** URL of the AudioWorklet module served from `public/`. */
export const PCM_WORKLET_URL = '/worklets/pcm-capture.js';
export const PCM_WORKLET_NAME = 'pcm-capture';

export function connectMicSocket(): MicSocket {
  return io(`${getApiBaseUrl()}${WS_NAMESPACE_MIC}`, {
    transports: ['websocket'],
    reconnection: true,
  });
}
