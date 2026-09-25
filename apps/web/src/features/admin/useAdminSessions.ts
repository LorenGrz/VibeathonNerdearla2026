'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { WS_NAMESPACE_ADMIN, type SessionDto } from '@subs/domain';
import { API_BASE_URL, fetchSessions } from './api';

export interface UseAdminSessionsResult {
  sessions: SessionDto[];
  connected: boolean;
  setSessions: React.Dispatch<React.SetStateAction<SessionDto[]>>;
}

/**
 * Subscribes to the `/admin` Socket.IO namespace and keeps the latest `sessions:snapshot`.
 * Renders gracefully while the API is unreachable: `connected` stays `false` and `sessions` stays empty.
 */
export function useAdminSessions(): UseAdminSessionsResult {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1. Immediately fetch sessions via REST on mount so the UI is never blank
    fetchSessions()
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch(() => {});

    // 2. Connect via Socket.IO for real-time periodic updates
    const socket = io(`${API_BASE_URL}${WS_NAMESPACE_ADMIN}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleSnapshot = (snapshot: SessionDto[]) => {
      if (!cancelled) setSessions(snapshot);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    socket.on('sessions:snapshot', handleSnapshot);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      cancelled = true;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
      socket.off('sessions:snapshot', handleSnapshot);
      socket.disconnect();
    };
  }, []);

  return { sessions, connected, setSessions };
}
