'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';

export interface CaptionControlsProps {
  onIncrease: () => void;
  onDecrease: () => void;
  onToggleContrast: () => void;
  highContrast: boolean;
  onCopy?: () => Promise<boolean>;
  onDownloadTxt?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export function CaptionControls({
  onIncrease,
  onDecrease,
  onToggleContrast,
  highContrast,
  onCopy,
  onDownloadTxt,
  onToggleFullscreen,
  isFullscreen,
}: CaptionControlsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!onCopy) return;
    const ok = await onCopy();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3" role="toolbar" aria-label="Herramientas de subtítulos">
      <div className="flex items-center gap-1.5" role="group" aria-label="Tipografía">
        <Button variant="ghost" onClick={onDecrease} aria-label="Reducir tamaño de fuente" className="text-xs px-2.5 py-1">
          A-
        </Button>
        <Button variant="ghost" onClick={onIncrease} aria-label="Aumentar tamaño de fuente" className="text-xs px-2.5 py-1">
          A+
        </Button>
        <Button
          variant={highContrast ? 'primary' : 'ghost'}
          active={highContrast}
          onClick={onToggleContrast}
          aria-pressed={highContrast}
          className="text-xs px-2.5 py-1"
        >
          {highContrast ? 'Contraste normal' : 'Alto contraste'}
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        {onCopy ? (
          <Button
            variant="ghost"
            onClick={handleCopy}
            className="text-xs px-2.5 py-1 text-text-soft hover:text-text"
            title="Copiar transcripción completa"
          >
            {copied ? '✓ ¡Copiado!' : '📋 Copiar'}
          </Button>
        ) : null}

        {onDownloadTxt ? (
          <Button
            variant="ghost"
            onClick={onDownloadTxt}
            className="text-xs px-2.5 py-1 text-text-soft hover:text-text"
            title="Descargar archivo TXT"
          >
            ⬇ Guardar TXT
          </Button>
        ) : null}

        {onToggleFullscreen ? (
          <Button
            variant="ghost"
            onClick={onToggleFullscreen}
            className="text-xs px-2.5 py-1 text-text-soft hover:text-text"
            title="Modo pantalla completa"
          >
            {isFullscreen ? '✕ Salir' : '⛶ Pantalla completa'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
