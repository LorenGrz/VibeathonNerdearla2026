import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface-2/95 backdrop-blur-md">
      <div className="h-1 w-full bg-gradient-to-r from-brand via-accent to-teal" aria-hidden="true" />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-baseline gap-2 transition-opacity hover:opacity-90">
            <span className="font-display text-2xl font-bold uppercase tracking-tight text-text">
              Live<span className="text-brand">Subs</span>
            </span>
            <span className="hidden rounded bg-line px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-accent sm:inline">
              Nerdearla 2026
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="rounded-btn px-3 py-1.5 text-xs font-medium text-text-soft transition-colors hover:bg-surface hover:text-text"
            >
              Salas en vivo
            </Link>
            <Link
              href="/admin"
              className="rounded-btn px-3 py-1.5 text-xs font-medium text-text-soft transition-colors hover:bg-surface hover:text-text"
            >
              Panel de producción
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-chip border border-teal/30 bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            <span className="hidden sm:inline">Nerdearla</span> Online
          </span>
        </div>
      </div>
    </header>
  );
}
