'use client';

import type { VideoInfo } from './videoSource';

interface VideoPlayerProps {
  video: VideoInfo;
  onClose?: () => void;
}

export function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  return (
    <div className="flex flex-col rounded-cta border border-line bg-surface-2 overflow-hidden shadow-md">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand" />
          <span className="font-display font-bold uppercase tracking-wider text-text">
            Video Original de la Charla
          </span>
          <span className="text-text-muted hidden sm:inline truncate max-w-xs">
            ({video.title})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={video.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-surface-2 hover:bg-line px-2 py-0.5 text-[11px] font-semibold text-accent transition-colors"
          >
            Abrir en otra pestaña ↗
          </a>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-text-muted hover:text-text px-1 text-sm font-bold"
              title="Cerrar video split"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={video.embedUrl}
          title={video.title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      <div className="p-3 bg-surface text-[11px] text-text-soft flex items-center justify-between gap-2">
        <p>
          💡 <strong>Sincronización:</strong> El audio de la sesión proviene de este video (a partir del minuto 1:00). Podés darle Play para escuchar y comparar la traducción en simultáneo.
        </p>
      </div>
    </div>
  );
}
