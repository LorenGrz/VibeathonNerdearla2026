import Link from 'next/link';
import type { ExportFormat, SessionDto, SessionStatus } from '@subs/domain';
import { exportUrl } from '../api';
import { formatBytes, formatLastActivity, formatLatency, isStale } from '../format';

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'Inactiva',
  starting: 'Iniciando',
  live: 'En vivo',
  stopped: 'Detenida',
  error: 'Error',
};

const STATUS_CLASS: Record<SessionStatus, string> = {
  idle: 'border-line-strong text-text-soft',
  starting: 'border-accent text-accent',
  live: 'border-teal text-teal',
  stopped: 'border-line-strong text-text-muted',
  error: 'border-brand text-brand-soft',
};

const EXPORT_FORMATS: ExportFormat[] = ['srt', 'vtt', 'txt'];

interface SessionsTableProps {
  sessions: SessionDto[];
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
}

function sessionLanguages(session: SessionDto) {
  return Array.from(new Set([session.sourceLanguage, ...session.targetLanguages]));
}

export function SessionsTable({ sessions, onStart, onStop, onDelete }: SessionsTableProps) {
  if (sessions.length === 0) {
    return (
      <section className="rounded-cta border border-line bg-surface-2 p-6 text-text-soft">
        Todavía no hay sesiones. Creá una con el formulario o usá la demo.
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded-cta border border-line bg-surface-2">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase text-text-muted">
          <tr>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Escenario</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Chunks</th>
            <th className="px-4 py-3">Latencia p50/p95</th>
            <th className="px-4 py-3">Errores</th>
            <th className="px-4 py-3">Actividad</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const stale = isStale(session.status, session.metrics.lastActivityAt);
            const canStop = session.status === 'live' || session.status === 'starting';

            return (
              <tr
                key={session.id}
                className={`border-b border-line last:border-0 ${stale ? 'bg-brand-tint' : ''}`}
              >
                <td className="px-4 py-3 font-medium">{session.title}</td>
                <td className="px-4 py-3 text-text-soft">{session.stage}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-chip border px-3 py-1 text-xs uppercase ${STATUS_CLASS[session.status]}`}
                  >
                    {STATUS_LABEL[session.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-soft">
                  {session.metrics.chunksIn} · {formatBytes(session.metrics.bytesIn)}
                </td>
                <td className="px-4 py-3 text-text-soft">
                  {formatLatency(session.metrics.latencyP50Ms)} /{' '}
                  {formatLatency(session.metrics.latencyP95Ms)}
                </td>
                <td className="px-4 py-3 text-text-soft">
                  {session.metrics.errors}
                  {session.metrics.lastError ? (
                    <span className="block text-xs text-brand-soft">
                      {session.metrics.lastError}
                    </span>
                  ) : null}
                </td>
                <td className={`px-4 py-3 ${stale ? 'text-brand-soft' : 'text-text-soft'}`}>
                  {formatLastActivity(session.metrics.lastActivityAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {canStop ? (
                      <button
                        type="button"
                        onClick={() => onStop(session.id)}
                        className="rounded-btn border border-line-strong px-2 py-1 text-xs"
                      >
                        Detener
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStart(session.id)}
                        className="rounded-btn bg-brand px-2 py-1 text-xs font-semibold text-white"
                      >
                        Iniciar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(session.id)}
                      className="rounded-btn border border-line-strong px-2 py-1 text-xs text-brand-soft"
                    >
                      Eliminar
                    </button>
                    <Link href={`/s/${session.id}`} className="text-xs text-teal underline">
                      Audiencia
                    </Link>
                    <Link href={`/overlay/${session.id}`} className="text-xs text-teal underline">
                      Overlay
                    </Link>
                    <div className="flex flex-col gap-1 text-xs text-text-muted">
                      {sessionLanguages(session).map((lang) => (
                        <span key={lang} className="flex items-center gap-1">
                          {lang}:
                          {EXPORT_FORMATS.map((format) => (
                            <a
                              key={format}
                              href={exportUrl(session.id, lang, format)}
                              className="text-teal underline"
                            >
                              {format}
                            </a>
                          ))}
                        </span>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
