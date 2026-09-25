import { notFound } from 'next/navigation';
import { isSupportedLanguage } from '@subs/domain';
import type { LanguageCodeValue } from '@subs/domain';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { CaptionsClient } from '@/features/captions/CaptionsClient';
import { fetchSession, sessionLanguages } from '@/lib/api';

export default async function SessionPage(props: PageProps<'/s/[id]'>) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const result = await fetchSession(id);

  if (result.status === 'not-found') {
    notFound();
  }

  if (result.status === 'error') {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            title="No se pudo cargar la sesión"
            description={result.message}
            hint="Iniciá la API: pnpm dev"
          />
        </main>
      </div>
    );
  }

  const { session } = result;
  const languages = sessionLanguages(session);
  const requestedLang = Array.isArray(searchParams.lang) ? searchParams.lang[0] : searchParams.lang;
  const initialLanguage: LanguageCodeValue =
    requestedLang && isSupportedLanguage(requestedLang) && languages.includes(requestedLang)
      ? requestedLang
      : session.sourceLanguage;

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="flex flex-1 flex-col">
        <div className="border-b border-line bg-surface-2 px-4 py-3">
          <p className="font-display text-xs uppercase tracking-wide text-text-muted">
            {session.stage}
          </p>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-semibold uppercase text-text">
              {session.title}
            </h1>
            <Badge tone={session.status === 'live' ? 'live' : 'neutral'}>{session.status}</Badge>
          </div>
        </div>
        <CaptionsClient
          sessionId={session.id}
          languages={languages}
          initialLanguage={initialLanguage}
          initialStatus={session.status}
        />
      </main>
    </div>
  );
}
