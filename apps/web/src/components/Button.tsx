import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-bright',
  secondary: 'border border-line-strong bg-transparent text-text hover:border-accent',
  ghost: 'bg-transparent text-text-soft hover:text-text',
};

export interface ButtonClassNameOptions {
  active?: boolean;
  className?: string;
}

/** Shared class builder so non-button elements (e.g. `next/link`) can look like a Button. */
export function buttonClassName(
  variant: ButtonVariant = 'secondary',
  options?: ButtonClassNameOptions,
): string {
  const { active = false, className = '' } = options ?? {};
  return [
    'inline-flex items-center justify-center gap-2 rounded-cta px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide transition-colors',
    'focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT_CLASSES[variant],
    active ? 'ring-2 ring-accent' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  active?: boolean;
}

export function Button({
  variant = 'secondary',
  active = false,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button type="button" className={buttonClassName(variant, { active, className })} {...rest} />
  );
}
