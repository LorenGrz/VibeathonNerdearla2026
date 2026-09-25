import Link from 'next/link';
import type { SessionDto } from '@subs/domain';
import { Badge } from '@/components/Badge';
import { buttonClassName } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { QuickDemoButton } from '@/components/QuickDemoButton';
import { fetchSessions, languageLabel, sessionLanguages } from '@/lib/api';

export const dynamic = 'force-dynamic';

function sourceIcon(kind: string) {
  switch (kind) {
    case 'mic':
      return '🎙️ Micrófono';
    case 'url':
      return '🌐 Streaming';
    case 'file':
    default:
      return '📁 Grabación';
  }
}

function SessionCard({ session }: { session: SessionDto }) {
  const languages = sessionLanguages(session);
  const isLive = session.status === 'live';
  const defaultTarget = session.targetLanguages[0] ?? session.sourceLanguage;

  return (
    <li
      className={`group flex flex-col justify-between gap-4 rounded-cta border p-5 transition-all duration-200 ${
        isLive
          ? 'border-brand/50 bg-surface-2 shadow-[0_0_25px_-5px_rgba(224,40,50,0.18)] ring-1 ring-brand/30'
          : 'border-line bg-surface-2/80 hover:border-line-strong'
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-xs uppercase tracking-wider text-text-muted">
                {session.stage}
              </span>
              <span className="text-[11px] text-text-muted">·</span>
              <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-text-soft">
                {sourceIcon(session.source.kind)}
              </span>
            </div>
            <Link
              href={`/s/${session.id}?lang=${defaultTarget}`}
              className="font-display text-xl font-bold uppercase tracking-tight text-text group-hover:text-accent transition-colors"
            >
              {session.title}
            </Link>
          </div>
          <Badge tone={isLive ? 'live' : 'neutral'}>{session.status}</Badge>
        </div>

        <div className="flex items-center gap-2 rounded-btn bg-surface px-3 py-2 text-xs">
          <span className="text-text-muted">Audio:</span>
          <span className="font-semibold text-text">{languageLabel(session.sourceLanguage)}</span>
          <span className="text-accent">➜</span>
          <span className="text-text-muted">Subtítulos:</span>
          <span className="font-semibold text-accent">
            {session.targetLanguages.map(languageLabel).join(', ') || 'Original'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-line/60">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-text-muted font-display">
            Elegir idioma:
          </p>
          <Link
            href={`/s/${session.id}?lang=${defaultTarget}`}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Abrir sala ↗
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {languages.map((lang) => {
            const isTarget = session.targetLanguages.includes(lang);
            return (
              <Link
                key={lang}
                href={`/s/${session.id}?lang=${lang}`}
                className={buttonClassName(isTarget && isLive ? 'primary' : 'secondary', {
                  className: 'text-xs py-1.5 px-3',
                })}
              >
                {languageLabel(lang)} {isTarget ? '★' : ''}
              </Link>
            );
          })}
          <Link
            href={`/overlay/${session.id}?lang=${defaultTarget}`}
            target="_blank"
            className="ml-auto text-xs text-text-muted hover:text-teal transition-colors"
            title="Abrir vista overlay para OBS / streaming"
          >
            OBS Overlay ↗
          </Link>
        </div>
      </div>
    </li>
  );
}

export default async function HomePage() {
  const result = await fetchSessions();

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <p className="font-display text-xs uppercase tracking-widest text-text-muted">
                Live AI Captions & Translations · Nerdearla 2026
              </p>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase leading-none tracking-tight text-text">
              Subtítulos en vivo, <span className="text-accent">para toda la comunidad</span>
            </h1>
            <p className="text-text-soft text-sm sm:text-base">
              Seguí cualquier charla de la conferencia con transcripción simultánea y traducción automática impulsada por Google Gemini Live.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <QuickDemoButton />
            <Link
              href="/admin"
              className="text-center text-xs text-text-muted hover:text-text transition-colors"
            >
              Ir al panel de producción →
            </Link>
          </div>
        </div>

        {result.status === 'error' ? (
          <EmptyState
            title="No se pudo conectar con la API"
            description={result.message}
            hint="Iniciá la API: pnpm dev"
          />
        ) : result.sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-cta border border-line bg-surface-2 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface border border-line text-2xl">
              🎙️
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-lg uppercase font-semibold text-text">
                Todavía no hay sesiones activas
              </h3>
              <p className="text-sm text-text-soft max-w-md">
                Podés lanzar la demo multi-sala instantáneamente para probar la transcripción y traducción en tiempo real.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <QuickDemoButton />
              <Link href="/admin" className={buttonClassName('secondary')}>
                Ir al panel de producción
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg uppercase font-semibold text-text flex items-center gap-2">
                <span>Salas disponibles</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">
                  {result.sessions.length}
                </span>
              </h2>
              <Link href="/admin" className="text-xs text-accent hover:underline">
                Gestionar en panel de producción →
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
