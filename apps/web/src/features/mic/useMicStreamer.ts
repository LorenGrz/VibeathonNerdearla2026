'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PCM_WORKLET_NAME, PCM_WORKLET_URL, connectMicSocket, type MicSocket } from './api';
import { PcmEncoder, meterLevel } from './pcm';

/**
 * idle -> requesting (mic permission) -> connecting (socket + `mic:start`) -> streaming.
 * A dropped socket goes back to `connecting` and re-claims the session on reconnect.
 */
export type MicPhase = 'idle' | 'requesting' | 'connecting' | 'streaming' | 'error';

export interface UseMicStreamerResult {
  phase: MicPhase;
  error: string | null;
  /** VU meter position, [0, 1] on a -60..0 dBFS scale. */
  level: number;
  framesSent: number;
  start: () => Promise<void>;
  stop: () => void;
}

interface MicResources {
  stream: MediaStream;
  context: AudioContext;
  node: AudioWorkletNode;
  socket: MicSocket;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: true,
  autoGainControl: true,
};

function describeMediaError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Permiso de micrófono denegado.';
    if (error.name === 'NotFoundError') return 'No se encontró ningún micrófono.';
    if (error.name === 'NotReadableError') return 'El micrófono está en uso por otra aplicación.';
  }
  return error instanceof Error ? error.message : 'No se pudo iniciar el micrófono.';
}

/** Captures the browser mic and streams 100 ms Int16 16 kHz frames to `/mic` for `sessionId`. */
export function useMicStreamer(sessionId: string): UseMicStreamerResult {
  const [phase, setPhase] = useState<MicPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [framesSent, setFramesSent] = useState(0);
  const resourcesRef = useRef<MicResources | null>(null);
  const streamingRef = useRef(false);
  /** Bumped by stop/unmount so an in-flight `start()` knows it was cancelled. */
  const generationRef = useRef(0);

  const teardown = useCallback((): void => {
    streamingRef.current = false;
    const resources = resourcesRef.current;
    resourcesRef.current = null;
    if (!resources) return;
    resources.node.port.onmessage = null;
    resources.node.disconnect();
    resources.stream.getTracks().forEach((track) => track.stop());
    void resources.context.close();
    resources.socket.removeAllListeners();
    resources.socket.disconnect();
  }, []);

  const fail = useCallback(
    (message: string): void => {
      teardown();
      setError(message);
      setLevel(0);
      setPhase('error');
    },
    [teardown],
  );

  const start = useCallback(async (): Promise<void> => {
    if (resourcesRef.current) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    const isCurrent = (): boolean => generation === generationRef.current;
    setError(null);
    setFramesSent(0);
    setPhase('requesting');

    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Este navegador no permite capturar audio (se requiere HTTPS o localhost).',
        );
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      context = new AudioContext();
      await context.audioWorklet.addModule(PCM_WORKLET_URL);
      await context.resume();
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      if (isCurrent()) fail(describeMediaError(cause));
      return;
    }
    if (!isCurrent()) {
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      return;
    }

    // source -> worklet -> muted gain -> destination: keeps the worklet pulled without echo.
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, PCM_WORKLET_NAME);
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(context.destination);

    const socket = connectMicSocket();
    resourcesRef.current = { stream, context, node, socket };
    setPhase('connecting');

    const encoder = new PcmEncoder(context.sampleRate);
    node.port.onmessage = (event: MessageEvent<Float32Array>): void => {
      const frames = encoder.push(event.data);
      const last = frames.at(-1);
      if (!last) return;
      setLevel(meterLevel(last.rms));
      if (!streamingRef.current || !socket.connected) return;
      for (const frame of frames) socket.emit('mic:chunk', frame.pcm.buffer);
      setFramesSent((count) => count + frames.length);
    };

    socket.on('connect', () => {
      setError(null);
      socket.emit('mic:start', { sessionId });
    });
    socket.on('mic:started', () => {
      streamingRef.current = true;
      setPhase('streaming');
    });
    socket.on('mic:error', ({ message }) => fail(message));
    socket.on('disconnect', () => {
      streamingRef.current = false;
      if (resourcesRef.current) setPhase('connecting');
    });
    socket.on('connect_error', () => setError('No se pudo conectar con la API. Reintentando…'));
  }, [fail, sessionId]);

  const stop = useCallback((): void => {
    generationRef.current += 1;
    const socket = resourcesRef.current?.socket;
    if (socket?.connected) socket.emit('mic:stop', { sessionId });
    teardown();
    setLevel(0);
    setPhase('idle');
  }, [sessionId, teardown]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      teardown();
    },
    [teardown],
  );

  return { phase, error, level, framesSent, start, stop };
}
