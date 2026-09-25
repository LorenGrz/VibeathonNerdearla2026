'use client';

import { useEffect, useRef, useState } from 'react';
import type { CaptionDto, SessionStatus } from '@subs/domain';

const AUTO_SCROLL_THRESHOLD_PX = 48;

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export interface CaptionParagraph {
  id: string;
  startMs: number;
  endMs: number;
  language: string;
  kind: string;
  text: string;
}

export function groupCaptionsIntoParagraphs(
  captions: CaptionDto[],
  maxGapMs = 6000,
): CaptionParagraph[] {
  if (captions.length === 0) return [];
  const paragraphs: CaptionParagraph[] = [];
  let current: CaptionParagraph | null = null;

  for (const c of captions) {
    const text = c.text.trim();
    if (!text) continue;

    if (!current) {
      current = {
        id: c.id,
        startMs: c.startMs,
        endMs: c.endMs,
        language: c.language,
        kind: c.kind,
        text,
      };
      continue;
    }

    const isSameKind = current.kind === c.kind && current.language === c.language;
    const isClose = c.startMs - current.endMs <= maxGapMs;
    const isUnderMax = current.text.length < 320;

    if (isSameKind && isClose && isUnderMax) {
      current.text = `${current.text} ${text}`;
      current.endMs = Math.max(current.endMs, c.endMs);
    } else {
      paragraphs.push(current);
      current = {
        id: c.id,
        startMs: c.startMs,
        endMs: c.endMs,
        language: c.language,
        kind: c.kind,
        text,
      };
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs;
}

export interface CaptionFeedProps {
  finals: CaptionDto[];
  partial: CaptionDto | null;
  fontSizeClassName: string;
  highContrast: boolean;
  sessionStatus?: SessionStatus | null;
  onRestart?: () => void;
}

export function CaptionFeed({
  finals,
  partial,
  fontSizeClassName,
  highContrast,
  sessionStatus,
  onRestart,
}: CaptionFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Pause autoscroll once the user scrolls away from the bottom of the feed.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = (): void => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAutoScroll(distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [finals, partial, autoScroll]);

  const isEmpty = finals.length === 0 && !partial;
  const isLive = sessionStatus === 'live';
  const paragraphs = groupCaptionsIntoParagraphs(finals);

  return (
    <div className="relative flex flex-col flex-1 min-h-[420px] h-[calc(100dvh-17rem)] rounded-cta border border-line bg-surface-2 overflow-hidden shadow-sm">
      {/* Live Audio Ambient Header */}
      {isLive ? (
        <div className="flex items-center justify-between border-b border-line bg-surface/70 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            <span className="font-display font-bold uppercase tracking-wider text-teal">
              En Vivo
            </span>
            <span className="text-text-muted hidden sm:inline">
              · Transmitiendo audio a Gemini Live API en tiempo real
            </span>
          </div>
          <div className="flex items-center gap-1.5" aria-hidden="true" title="Audio activo">
            <span className="h-3 w-1 rounded-full bg-teal animate-pulse" />
            <span className="h-4.5 w-1 rounded-full bg-accent animate-pulse [animation-delay:150ms]" />
            <span className="h-2.5 w-1 rounded-full bg-brand animate-pulse [animation-delay:300ms]" />
            <span className="h-5 w-1 rounded-full bg-teal animate-pulse [animation-delay:200ms]" />
          </div>
        </div>
      ) : null}

      {/* Main Subtitles Container */}
      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        className={`flex-1 overflow-y-auto p-4 sm:p-6 ${
          highContrast ? 'bg-black text-white' : 'bg-surface-2 text-text'
        } ${fontSizeClassName}`}
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            {sessionStatus === 'stopped' ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface border border-line text-text-muted text-2xl">
                  ⏹
                </div>
                <p className="font-display text-lg uppercase font-semibold text-text">
                  Sesión finalizada
                </p>
                <p className="text-xs text-text-muted max-w-sm">
                  Esta sesión ha terminado. Podés reiniciar la reproducción para continuar viendo subtítulos.
                </p>
                {onRestart ? (
                  <button
                    type="button"
                    onClick={onRestart}
                    className="mt-2 rounded-cta bg-brand hover:bg-brand-bright px-4 py-2 font-display text-xs uppercase font-bold text-white shadow-md transition-all active:scale-95"
                  >
                    🔄 Reiniciar reproducción
                  </button>
                ) : null}
              </>
            ) : sessionStatus === 'idle' ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface border border-line text-accent text-2xl">
                  ⏳
                </div>
                <p className="font-display text-lg uppercase font-semibold text-text">
                  Sesión en espera
                </p>
                <p className="text-xs text-text-muted max-w-sm">
                  La sesión todavía no ha sido iniciada.
                </p>
                {onRestart ? (
                  <button
                    type="button"
                    onClick={onRestart}
                    className="mt-2 rounded-cta bg-brand hover:bg-brand-bright px-4 py-2 font-display text-xs uppercase font-bold text-white shadow-md transition-all active:scale-95"
                  >
                    ▶ Iniciar sesión ahora
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 py-3" aria-hidden="true">
                  <span className="h-8 w-1.5 rounded-full bg-teal animate-pulse" />
                  <span className="h-12 w-1.5 rounded-full bg-accent animate-pulse [animation-delay:150ms]" />
                  <span className="h-6 w-1.5 rounded-full bg-brand animate-pulse [animation-delay:300ms]" />
                  <span className="h-10 w-1.5 rounded-full bg-teal animate-pulse [animation-delay:200ms]" />
                </div>
                <p className="font-display text-lg uppercase font-semibold text-text">
                  {sessionStatus === 'starting' ? 'Iniciando conexión…' : 'Escuchando en vivo…'}
                </p>
                <p className="text-xs text-text-muted max-w-sm">
                  El motor de Gemini está conectado. En breves instantes los subtítulos comenzarán a generarse.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {paragraphs.map((paragraph) => (
              <article
                key={paragraph.id}
                className={`group rounded-xl border p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-1 ${
                  highContrast
                    ? 'border-zinc-800 bg-zinc-950 text-white'
                    : 'border-line/60 bg-surface/70 text-text shadow-sm hover:border-line'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2 text-xs text-text-muted font-display select-none">
                  <span className="font-mono text-[11px] text-text-soft">
                    {formatTimestamp(paragraph.startMs)}
                  </span>
                  <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent font-semibold">
                    {paragraph.kind === 'translation'
                      ? `${paragraph.language.toUpperCase()} · IA`
                      : `${paragraph.language.toUpperCase()} · Original`}
                  </span>
                </div>
                <p className="leading-relaxed font-sans font-normal">
                  {paragraph.text}
                </p>
              </article>
            ))}

            {/* Interim Partial Streaming Caption */}
            {partial ? (
              <article
                key={partial.id}
                className={`rounded-xl border border-accent/60 bg-accent/5 p-4 transition-all duration-150 ${
                  highContrast ? 'border-accent bg-zinc-900 text-accent' : 'text-accent'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2 text-xs font-display select-none">
                  <span className="font-mono text-[11px] text-accent/80">
                    {formatTimestamp(partial.startMs)}
                  </span>
                  <span className="flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] uppercase font-bold text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
                    Generando…
                  </span>
                </div>
                <p className="leading-relaxed font-sans font-medium">
                  {partial.text}
                  <span className="inline-block w-2 h-4 ml-1.5 bg-accent align-middle animate-pulse" />
                </p>
              </article>
            ) : null}

            {/* Session Ended Bottom Banner */}
            {sessionStatus === 'stopped' && finals.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-xs text-text-soft">
                <span className="flex items-center gap-1.5">
                  <span>⏹</span> Transmisión concluida · {finals.length} segmentos procesados
                </span>
                {onRestart ? (
                  <button
                    type="button"
                    onClick={onRestart}
                    className="rounded-btn bg-brand hover:bg-brand-bright px-3 py-1 font-display text-xs uppercase font-bold text-white shadow-sm transition-all"
                  >
                    🔄 Reiniciar audio
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Floating Return to Bottom Button */}
      {!autoScroll ? (
        <button
          type="button"
          onClick={() => setAutoScroll(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-chip border border-accent bg-surface-2/95 backdrop-blur-sm px-4 py-1.5 font-display text-xs uppercase font-bold text-accent shadow-lg hover:brightness-110 transition-all"
        >
          ↓ Volver al final
        </button>
      ) : null}
    </div>
  );
}
