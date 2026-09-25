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
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip border px-3 py-1 text-xs uppercase font-display font-semibold ${STATUS_CLASS[session.status]}`}
                  >
                    {session.status === 'live' ? (
                      <span className="relative flex h-2 w-2" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-bright opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-bright" />
                      </span>
                    ) : null}
                    {STATUS_LABEL[session.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-soft">
                  <span className="font-medium text-text">{session.metrics.chunksIn}</span>
                  <span className="text-xs text-text-muted"> ({formatBytes(session.metrics.bytesIn)})</span>
                </td>
                <td className="px-4 py-3 text-text-soft text-xs">
                  {formatLatency(session.metrics.latencyP50Ms)} /{' '}
                  {formatLatency(session.metrics.latencyP95Ms)}
                </td>
                <td className="px-4 py-3 text-text-soft text-xs">
                  {session.metrics.errors > 0 ? (
                    <span className="text-brand-soft font-semibold">{session.metrics.errors} err</span>
                  ) : (
                    <span className="text-teal">0</span>
                  )}
                  {session.metrics.lastError ? (
                    <span className="block max-w-xs truncate text-[11px] text-brand-soft" title={session.metrics.lastError}>
                      {session.metrics.lastError}
                    </span>
                  ) : null}
                </td>
                <td className={`px-4 py-3 text-xs ${stale ? 'text-brand-soft' : 'text-text-soft'}`}>
                  {formatLastActivity(session.metrics.lastActivityAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canStop ? (
                        <button
                          type="button"
                          onClick={() => onStop(session.id)}
                          className="rounded-btn border border-brand/50 bg-brand/10 hover:bg-brand/20 px-2.5 py-1 text-xs font-semibold text-brand-soft transition-colors"
                        >
                          Detener
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onStart(session.id)}
                          className="rounded-btn bg-brand hover:bg-brand-bright px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all"
                        >
                          {session.status === 'stopped' ? '🔄 Reiniciar' : 'Iniciar'}
                        </button>
                      )}
                      <Link
                        href={`/s/${session.id}`}
                        target="_blank"
                        className="rounded-btn border border-teal/40 bg-teal/10 hover:bg-teal/20 px-2 py-1 text-xs font-medium text-teal transition-colors"
                      >
                        Audiencia ↗
                      </Link>
                      <Link
                        href={`/overlay/${session.id}`}
                        target="_blank"
                        className="rounded-btn border border-line bg-surface hover:bg-surface-2 px-2 py-1 text-xs text-text-soft transition-colors"
                      >
                        Overlay
                      </Link>
                      {session.source.kind === 'mic' ? (
                        <Link
                          href={`/admin/mic/${session.id}`}
                          className="rounded-btn border border-accent/40 bg-accent/10 hover:bg-accent/20 px-2 py-1 text-xs font-semibold text-accent transition-colors"
                        >
                          🎙️ Micrófono
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDelete(session.id)}
                        className="rounded-btn border border-line hover:border-brand-soft/40 px-2 py-1 text-xs text-text-muted hover:text-brand-soft transition-colors"
                        title="Eliminar sesión"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                      <span className="font-display uppercase text-text-muted">Exportar:</span>
                      {sessionLanguages(session).map((lang) => (
                        <span key={lang} className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 border border-line">
                          <span className="font-semibold text-text uppercase">{lang}</span>
                          {EXPORT_FORMATS.map((format) => (
                            <a
                              key={format}
                              href={exportUrl(session.id, lang, format)}
                              className="text-teal hover:underline uppercase text-[10px]"
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
