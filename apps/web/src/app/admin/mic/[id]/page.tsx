import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { MicClient } from '@/features/mic/MicClient';
import { fetchSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Micrófono · LiveSubs',
};

// TODO(auth): sin autenticación en el MVP, igual que /admin.
export default async function MicPage(props: PageProps<'/admin/mic/[id]'>) {
  const { id } = await props.params;
  const result = await fetchSession(id);

  if (result.status === 'not-found') {
    notFound();
  }

  let content;
  if (result.status === 'error') {
    content = (
      <EmptyState
        title="No se pudo cargar la sesión"
        description={result.message}
        hint="Iniciá la API: pnpm dev"
      />
    );
  } else if (result.session.source.kind !== 'mic') {
    content = (
      <EmptyState
        title="Esta sesión no usa micrófono"
        description="Creá una sesión con fuente «Micrófono» para transmitir desde el navegador."
      />
    );
  } else {
    content = (
      <MicClient
        sessionId={result.session.id}
        title={result.session.title}
        stage={result.session.stage}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center">{content}</main>
    </div>
  );
}
