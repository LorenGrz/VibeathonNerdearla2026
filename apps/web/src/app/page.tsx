import Link from 'next/link';
import type { SessionDto } from '@subs/domain';
import { Badge } from '@/components/Badge';
import { buttonClassName } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { fetchSessions, languageLabel, sessionLanguages } from '@/lib/api';

export const dynamic = 'force-dynamic';

function SessionCard({ session }: { session: SessionDto }) {
  const languages = sessionLanguages(session);

  return (
    <li className="flex flex-col gap-3 rounded-cta border border-line bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-xs uppercase tracking-wide text-text-muted">
            {session.stage}
          </p>
          <h2 className="font-display text-lg font-semibold uppercase text-text">
            {session.title}
          </h2>
        </div>
        <Badge tone={session.status === 'live' ? 'live' : 'neutral'}>{session.status}</Badge>
      </div>
      <p className="text-sm text-text-soft">
        Idioma original: {languageLabel(session.sourceLanguage)}
      </p>
      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => (
          <Link
            key={lang}
            href={`/s/${session.id}?lang=${lang}`}
            className={buttonClassName('secondary')}
          >
            {languageLabel(lang)}
          </Link>
        ))}
      </div>
    </li>
  );
}

export default async function HomePage() {
  const result = await fetchSessions();

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase text-text">
            Subtítulos en vivo, <span className="text-accent">para toda la comunidad</span>
          </h1>
          <p className="mt-2 text-text-soft">
            Elegí una sesión activa y seguí la charla en tu idioma, en tiempo real.
          </p>
        </div>
        {result.status === 'error' ? (
          <EmptyState
            title="No se pudo conectar con la API"
            description={result.message}
            hint="Iniciá la API: pnpm dev"
          />
        ) : result.sessions.length === 0 ? (
          <EmptyState
            title="Todavía no hay sesiones activas"
            description="Volvé a intentarlo en unos minutos."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {result.sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
