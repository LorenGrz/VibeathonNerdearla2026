'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** Minimal slice of the YouTube IFrame Player API we use. */
interface YTPlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: () => void; onStateChange?: (event: { data: number }) => void };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface YouTubeControls {
  ready: boolean;
  playing: boolean;
  currentTime(): number | null;
  seek(seconds: number): void;
}

/** Mounts a controllable YouTube player inside `containerRef`. */
export function useYouTubePlayer(
  containerRef: RefObject<HTMLDivElement | null>,
  videoId: string,
  startSeconds: number,
): YouTubeControls {
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = containerRef.current;
    if (!host) return;
    const mount = document.createElement('div');
    host.appendChild(mount);

    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mount, {
        videoId,
        playerVars: {
          start: Math.floor(startSeconds),
          autoplay: 1,
          rel: 0,
          playsinline: 1,
          // Our captions are the product: keep YouTube's own captions and annotations off.
          cc_load_policy: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => !cancelled && setReady(true),
          onStateChange: (event) => !cancelled && setPlaying(event.data === YT.PlayerState.PLAYING),
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      host.replaceChildren();
      setReady(false);
      setPlaying(false);
    };
  }, [containerRef, videoId, startSeconds]);

  // Stable identities: callers poll these from intervals that must not restart every render.
  const currentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? null, []);
  const seek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
    playerRef.current?.playVideo();
  }, []);

  return { ready, playing, currentTime, seek };
}
