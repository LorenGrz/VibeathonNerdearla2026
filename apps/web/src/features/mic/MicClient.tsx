'use client';

import Link from 'next/link';
import { Badge, type BadgeTone } from '@/components/Badge';
import { Button, buttonClassName } from '@/components/Button';
import { FRAME_MS } from './pcm';
import { useMicStreamer, type MicPhase } from './useMicStreamer';

const PHASE_LABEL: Record<MicPhase, string> = {
  idle: 'Micrófono apagado',
  requesting: 'Pidiendo permiso…',
  connecting: 'Conectando…',
  streaming: 'Transmitiendo',
  error: 'Error',
};

const PHASE_TONE: Record<MicPhase, BadgeTone> = {
  idle: 'neutral',
  requesting: 'warning',
  connecting: 'warning',
  streaming: 'live',
  error: 'error',
};

const METER_SEGMENTS = 24;

function segmentClass(index: number, lit: boolean): string {
  if (!lit) return 'bg-line';
  const position = index / METER_SEGMENTS;
  if (position >= 0.9) return 'bg-brand';
  if (position >= 0.7) return 'bg-accent';
  return 'bg-teal';
}

function VuMeter({ level }: { level: number }) {
  const lit = Math.round(level * METER_SEGMENTS);
  return (
    <div
      role="meter"
      aria-label="Nivel de entrada"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(level * 100)}
      className="flex h-6 w-full gap-1"
    >
      {Array.from({ length: METER_SEGMENTS }, (_, index) => (
        <span
          key={index}
          className={`flex-1 rounded-sm transition-colors ${segmentClass(index, index < lit)}`}
        />
      ))}
    </div>
  );
}

export interface MicClientProps {
  sessionId: string;
  title: string;
  stage: string;
}

export function MicClient({ sessionId, title, stage }: MicClientProps) {
  const { phase, error, level, framesSent, start, stop } = useMicStreamer(sessionId);
  const active = phase === 'requesting' || phase === 'connecting' || phase === 'streaming';
  const seconds = ((framesSent * FRAME_MS) / 1000).toFixed(1);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <p className="font-display text-xs uppercase tracking-wide text-text-muted">{stage}</p>
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
          <span className="block text-text">Micrófono</span>
          <span className="block text-accent">{title}</span>
        </h1>
      </div>

      <div className="flex flex-col gap-5 rounded-cta border border-line bg-surface-2 p-6">
        <div className="flex items-center justify-between gap-3">
          <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
          {active ? (
            <Button variant="secondary" onClick={stop}>
              Detener
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void start()}>
              Iniciar micrófono
            </Button>
          )}
        </div>

        <VuMeter level={level} />

        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl font-bold text-accent">{seconds} s</span>
          <span className="text-xs uppercase text-text-muted">de audio enviado</span>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-brand-soft">
            {error}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-text-soft">
        El audio solo se transcribe mientras la sesión está iniciada en el panel. Un solo navegador
        puede transmitir por sesión.
      </p>
      <Link href="/admin" className={buttonClassName('ghost', { className: 'self-start' })}>
        Volver al panel
      </Link>
    </section>
  );
}
