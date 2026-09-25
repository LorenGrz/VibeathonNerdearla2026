import type { AudioSourceSpec } from '@subs/domain';

export interface VideoInfo {
  youtubeId: string;
  watchUrl: string;
  embedUrl: string;
  startSeconds: number;
  title: string;
}

export const KNOWN_DEMO_VIDEOS: Record<string, VideoInfo> = {
  'en-nerdearla.mp3': {
    youtubeId: 'iaG9pHMJ3Y4',
    watchUrl: 'https://www.youtube.com/watch?v=iaG9pHMJ3Y4&t=60s',
    embedUrl: 'https://www.youtube-nocookie.com/embed/iaG9pHMJ3Y4?start=60&autoplay=1',
    startSeconds: 60,
    title: 'Model Context Protocol in Plain English (Nerdearla)',
  },
  'es-nerdearla.mp3': {
    youtubeId: 'nGeiH6GSIuU',
    watchUrl: 'https://www.youtube.com/watch?v=nGeiH6GSIuU&t=60s',
    embedUrl: 'https://www.youtube-nocookie.com/embed/nGeiH6GSIuU?start=60&autoplay=1',
    startSeconds: 60,
    title: 'No sos Netflix (Nerdearla)',
  },
};

export function resolveVideoInfo(source: AudioSourceSpec): VideoInfo | null {
  if (source.kind === 'file') {
    for (const [key, info] of Object.entries(KNOWN_DEMO_VIDEOS)) {
      if (source.path.includes(key)) {
        return info;
      }
    }
  }
  if (source.kind === 'url') {
    const ytMatch = source.url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
    );
    if (ytMatch?.[1]) {
      const id = ytMatch[1];
      return {
        youtubeId: id,
        watchUrl: source.url,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
        startSeconds: 0,
        title: 'Video en streaming',
      };
    }
  }
  return null;
}
