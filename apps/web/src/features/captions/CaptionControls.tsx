'use client';

import { Button } from '@/components/Button';

export interface CaptionControlsProps {
  onIncrease: () => void;
  onDecrease: () => void;
  onToggleContrast: () => void;
  highContrast: boolean;
}

export function CaptionControls({
  onIncrease,
  onDecrease,
  onToggleContrast,
  highContrast,
}: CaptionControlsProps) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Preferencias de lectura">
      <Button variant="ghost" onClick={onDecrease} aria-label="Reducir tamaño de fuente">
        A-
      </Button>
      <Button variant="ghost" onClick={onIncrease} aria-label="Aumentar tamaño de fuente">
        A+
      </Button>
      <Button
        variant={highContrast ? 'primary' : 'ghost'}
        active={highContrast}
        onClick={onToggleContrast}
        aria-pressed={highContrast}
      >
        Alto contraste
      </Button>
    </div>
  );
}
