export interface EmptyStateProps {
  title: string;
  description?: string;
  hint?: string;
}

export function EmptyState({ title, description, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-cta border border-line bg-glass p-8 text-center">
      <p className="font-display text-lg uppercase tracking-wide text-text">{title}</p>
      {description ? <p className="text-text-soft">{description}</p> : null}
      {hint ? <p className="text-sm text-text-muted">{hint}</p> : null}
    </div>
  );
}
