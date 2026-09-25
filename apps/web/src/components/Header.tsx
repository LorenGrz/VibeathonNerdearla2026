import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-line bg-surface-2">
      <div className="h-1 w-full bg-brand" aria-hidden="true" />
      <div className="mx-auto flex w-full max-w-5xl items-baseline gap-2 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold uppercase tracking-tight text-text">
            LiveSubs
          </span>
          <span className="text-xs text-text-muted">by Nerdearla community</span>
        </Link>
      </div>
    </header>
  );
}
