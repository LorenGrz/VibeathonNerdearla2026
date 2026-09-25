'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CreateSessionDto } from '@subs/domain';
import { createSession, deleteSession, fetchSamples, startSession, stopSession } from '../api';
import { buildDemoSessions } from '../demo';
import { formatBytes } from '../format';
import { useAdminSessions } from '../useAdminSessions';
import { ConnectionStatus } from './ConnectionStatus';
import { NewSessionForm } from './NewSessionForm';
import { SessionsTable } from './SessionsTable';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function AdminDashboard() {
  const { sessions, connected } = useAdminSessions();
  const [samples, setSamples] = useState<string[]>([]);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [demoPending, setDemoPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchSamples()
      .then((list) => {
        if (!cancelled) setSamples(list);
      })
      .catch(() => {
        if (!cancelled)
          setSamplesError('No se pudieron cargar los samples. Probá con URL o micrófono.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = useCallback(async (dto: CreateSessionDto) => {
    setActionError(null);
    try {
      await createSession(dto);
    } catch (error) {
      setActionError(errorMessage(error, 'No se pudo crear la sesión.'));
      throw error;
    }
  }, []);

  const handleStart = useCallback((id: string) => {
    setActionError(null);
    startSession(id).catch((error: unknown) => {
      setActionError(errorMessage(error, 'No se pudo iniciar la sesión.'));
    });
  }, []);

  const handleStop = useCallback((id: string) => {
    setActionError(null);
    stopSession(id).catch((error: unknown) => {
      setActionError(errorMessage(error, 'No se pudo detener la sesión.'));
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setActionError(null);
    deleteSession(id).catch((error: unknown) => {
      setActionError(errorMessage(error, 'No se pudo eliminar la sesión.'));
    });
  }, []);

  const handleDemo = useCallback(async () => {
    setActionError(null);
    setDemoPending(true);
    try {
      const currentSamples = samples.length > 0 ? samples : await fetchSamples();
      const demoSessions = buildDemoSessions(currentSamples);
      if (!demoSessions) {
        setActionError('No hay samples disponibles para la demo.');
        return;
      }
      const created = await Promise.all(demoSessions.map((dto) => createSession(dto)));
      await Promise.all(created.map((session) => startSession(session.id)));
    } catch (error) {
      setActionError(errorMessage(error, 'No se pudo iniciar la demo.'));
    } finally {
      setDemoPending(false);
    }
  }, [samples]);

  const liveCount = sessions.filter((s) => s.status === 'live').length;
  const totalChunks = sessions.reduce((acc, s) => acc + s.metrics.chunksIn, 0);
  const totalBytes = sessions.reduce((acc, s) => acc + s.metrics.bytesIn, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="font-display text-xs uppercase tracking-widest text-text-muted">
          Centro de Operaciones · Nerdearla 2026
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase leading-none">
            Panel de <span className="text-accent">producción</span>
          </h1>
          <ConnectionStatus connected={connected} />
        </div>
      </header>

      {/* KPI Stats Grid */}
      <section aria-label="Métricas del sistema" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-cta border border-line bg-surface-2 p-4">
          <span className="font-display text-xs uppercase text-text-muted">Sesiones en vivo</span>
          <div className="flex items-center gap-2">
            {liveCount > 0 ? (
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-teal" />
              </span>
            ) : (
              <span className="h-3 w-3 rounded-full bg-line-strong" />
            )}
            <span className="font-display text-2xl font-bold text-text">
              {liveCount} <span className="text-sm font-normal text-text-muted">/ {sessions.length}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-cta border border-line bg-surface-2 p-4">
          <span className="font-display text-xs uppercase text-text-muted">Audio procesado</span>
          <span className="font-display text-2xl font-bold text-accent">
            {formatBytes(totalBytes)}
          </span>
          <span className="text-[11px] text-text-muted">{totalChunks} chunks (100ms)</span>
        </div>

        <div className="flex flex-col gap-1 rounded-cta border border-line bg-surface-2 p-4">
          <span className="font-display text-xs uppercase text-text-muted">Servidor Realtime</span>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-teal' : 'bg-brand'}`} />
            <span className="font-display text-lg font-semibold text-text">
              {connected ? 'Socket.IO OK' : 'Desconectado'}
            </span>
          </div>
          <span className="text-[11px] text-text-muted">Rooms /captions & /admin</span>
        </div>

        <div className="flex flex-col gap-1 rounded-cta border border-line bg-surface-2 p-4">
          <span className="font-display text-xs uppercase text-text-muted">Motor de IA</span>
          <span className="font-display text-lg font-semibold text-teal truncate">
            Gemini Live API
          </span>
          <span className="text-[11px] text-text-muted">+ Flash-Lite para traducción</span>
        </div>
      </section>

      {actionError ? (
        <p
          role="alert"
          className="rounded-btn border border-brand bg-brand-tint px-4 py-2 text-sm text-brand-soft"
        >
          {actionError}
        </p>
      ) : null}

      {/* Demo Hero Banner */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-cta border border-accent/40 bg-gradient-to-r from-surface-2 via-surface-2 to-accent/5 p-6 shadow-[0_0_20px_-5px_rgba(255,186,0,0.1)]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent/20 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-accent">
              Vibeathon Mode
            </span>
            <h2 className="font-display text-xl uppercase font-bold text-text">
              Demo simultánea multi-sala
            </h2>
          </div>
          <p className="text-sm text-text-soft max-w-xl">
            Crea e inicia instantáneamente 2 sesiones concurrentes (EN ➜ ES y ES ➜ EN) para probar la capacidad multi-track en paralelo.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDemo}
          disabled={demoPending}
          className="rounded-cta bg-accent px-6 py-2.5 font-display font-bold uppercase tracking-wide text-ink hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
        >
          {demoPending ? 'Iniciando demo…' : '⚡ Lanzar Demo (2 Salas)'}
        </button>
      </section>

      {/* Sessions Management Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase font-bold text-text flex items-center gap-2">
            <span>Sesiones configuradas</span>
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-text-muted">
              {sessions.length}
            </span>
          </h2>
        </div>
        <SessionsTable
          sessions={sessions}
          onStart={handleStart}
          onStop={handleStop}
          onDelete={handleDelete}
        />
      </div>

      {/* New Session Creation */}
      <NewSessionForm samples={samples} samplesError={samplesError} onCreate={handleCreate} />
    </div>
  );
}
