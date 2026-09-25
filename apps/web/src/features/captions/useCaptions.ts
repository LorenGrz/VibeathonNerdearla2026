'use client';

import { useEffect, useReducer, useState } from 'react';
import type { CaptionDto, LanguageCodeValue, SessionStatus } from '@subs/domain';
import { connectCaptionsSocket, joinCaptionsRoom, leaveCaptionsRoom } from './api';
import { captionsReducer, initialCaptionsState } from './reducer';

import { getApiBaseUrl } from '@/lib/api';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseCaptionsResult {
  finals: CaptionDto[];
  partial: CaptionDto | null;
  connectionStatus: ConnectionStatus;
  sessionStatus: SessionStatus | null;
}

function roomKey(sessionId: string, language: LanguageCodeValue): string {
  return `${sessionId}:${language}`;
}

/** Joins the `/captions` room for `sessionId`+`language` and keeps captions state in sync via WS. */
export function useCaptions(
  sessionId: string,
  language: LanguageCodeValue,
  initialSessionStatus: SessionStatus | null = null,
): UseCaptionsResult {
  const [state, dispatch] = useReducer(captionsReducer, initialCaptionsState);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(initialSessionStatus);

  // Reset local state synchronously during render when the room changes (instead of in an
  // effect), so there is no flash of stale data from the previous room. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [currentRoom, setCurrentRoom] = useState(() => roomKey(sessionId, language));
  const nextRoom = roomKey(sessionId, language);
  if (nextRoom !== currentRoom) {
    setCurrentRoom(nextRoom);
    dispatch({ type: 'reset' });
    setConnectionStatus('connecting');
    setSessionStatus(initialSessionStatus);
  }

  useEffect(() => {
    let cancelled = false;

    // 1. Immediately fetch transcript via REST so existing captions render on first frame
    fetch(`${getApiBaseUrl()}/api/sessions/${encodeURIComponent(sessionId)}/transcript?lang=${encodeURIComponent(language)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((history: CaptionDto[]) => {
        if (!cancelled && Array.isArray(history) && history.length > 0) {
          dispatch({ type: 'history', captions: history });
        }
      })
      .catch(() => {});

    // 2. Connect via Socket.IO for live realtime streaming
    const socket = connectCaptionsSocket();

    const handleConnect = (): void => {
      setConnectionStatus('connected');
      joinCaptionsRoom(socket, sessionId, language);
    };
    const handleDisconnect = (): void => setConnectionStatus('disconnected');
    const handleConnectError = (): void => setConnectionStatus('disconnected');
    const handleHistory = (history: CaptionDto[]): void => {
      if (!cancelled) dispatch({ type: 'history', captions: history });
    };
    const handleCaption = (caption: CaptionDto): void => {
      if (!cancelled) dispatch({ type: 'caption', caption });
    };
    const handleSessionStatus = (payload: { id: string; status: SessionStatus }): void => {
      if (!cancelled) setSessionStatus(payload.status);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('captions:history', handleHistory);
    socket.on('caption', handleCaption);
    socket.on('session:status', handleSessionStatus);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      cancelled = true;
      leaveCaptionsRoom(socket, sessionId, language);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('captions:history', handleHistory);
      socket.off('caption', handleCaption);
      socket.off('session:status', handleSessionStatus);
      socket.disconnect();
    };
  }, [sessionId, language]);

  return { finals: state.finals, partial: state.partial, connectionStatus, sessionStatus };
}
