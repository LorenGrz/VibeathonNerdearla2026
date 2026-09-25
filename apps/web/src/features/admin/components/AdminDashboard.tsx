'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CreateSessionDto } from '@subs/domain';
import { createSession, deleteSession, fetchSamples, startSession, stopSession } from '../api';
import { buildDemoSessions } from '../demo';
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-display text-sm uppercase tracking-wide text-text-muted">LiveSubs</p>
        <h1 className="font-display text-4xl uppercase leading-none">
          Panel de <span className="text-accent">producción</span>
        </h1>
        <ConnectionStatus connected={connected} />
      </header>

      {actionError ? (
        <p
          role="alert"
          className="rounded-btn border border-brand bg-brand-tint px-4 py-2 text-sm text-brand-soft"
        >
          {actionError}
        </p>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-cta border border-line bg-surface-2 p-6">
        <div>
          <h2 className="font-display text-xl uppercase">Demo rápida</h2>
          <p className="text-sm text-text-soft">
            Crea y arranca dos sesiones (EN→ES y ES→EN) con los samples disponibles.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDemo}
          disabled={demoPending}
          className="rounded-cta bg-brand px-5 py-2 font-display font-semibold text-white disabled:opacity-50"
        >
          {demoPending ? 'Creando…' : 'Demo: 2 sesiones'}
        </button>
      </section>

      <NewSessionForm samples={samples} samplesError={samplesError} onCreate={handleCreate} />

      <SessionsTable
        sessions={sessions}
        onStart={handleStart}
        onStop={handleStop}
        onDelete={handleDelete}
      />
    </div>
  );
}
