import { spawn } from 'node:child_process';
import { resolve, sep } from 'node:path';
import type { AudioChunk, AudioSourcePort, AudioSourceSpec } from '@subs/domain';
import { AUDIO_FORMAT } from '@subs/domain';

const CHUNK_DURATION_MS = 100;
const BYTES_PER_SAMPLE = 2; // s16le
const CHUNK_BYTES =
  (AUDIO_FORMAT.sampleRate * AUDIO_FORMAT.channels * BYTES_PER_SAMPLE * CHUNK_DURATION_MS) / 1000;

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'rtmp:', 'srt:']);

export interface FfmpegAudioSourceOptions {
  /** Base directory used to resolve relative `file` sources; resolved against `process.cwd()` if relative. */
  samplesDir: string;
  /** Read at native playback speed via ffmpeg's `-re` flag. Defaults to `true`; set `false` in tests. */
  realtime?: boolean;
}

interface FfmpegExitResult {
  code: number | null;
  error?: Error;
}

/**
 * Streams PCM s16le 16 kHz mono audio out of ffmpeg (and yt-dlp for YouTube URLs) as fixed
 * 100 ms / 3200-byte chunks. `spawn` is always called with an argument array, never a shell.
 */
export class FfmpegAudioSource implements AudioSourcePort {
  private readonly samplesDir: string;
  private readonly realtime: boolean;

  constructor(options: FfmpegAudioSourceOptions) {
    this.samplesDir = resolve(process.cwd(), options.samplesDir);
    this.realtime = options.realtime ?? true;
  }

  async *open(spec: AudioSourceSpec, signal: AbortSignal): AsyncIterable<AudioChunk> {
    switch (spec.kind) {
      case 'file':
        yield* this.runFfmpeg(['-i', this.resolveFilePath(spec.path)], signal);
        return;
      case 'url':
        yield* this.openUrl(spec.url, signal);
        return;
      case 'mic':
        throw new Error(
          'FfmpegAudioSource does not support "mic" sources; use the mic WebSocket gateway instead.',
        );
    }
  }

  /**
   * Resolves paths against `samplesDir` and rejects anything outside it (absolute paths too):
   * the admin API is unauthenticated, so it must not be able to read arbitrary files.
   */
  private resolveFilePath(rawPath: string): string {
    const resolved = resolve(this.samplesDir, rawPath);
    const boundary = this.samplesDir.endsWith(sep) ? this.samplesDir : `${this.samplesDir}${sep}`;
    if (resolved !== this.samplesDir && !resolved.startsWith(boundary)) {
      throw new Error(`Path traversal rejected: "${rawPath}" resolves outside SAMPLES_DIR`);
    }
    return resolved;
  }

  private async *openUrl(rawUrl: string, signal: AbortSignal): AsyncIterable<AudioChunk> {
    if (signal.aborted) {
      return;
    }
    const parsed = this.validateUrl(rawUrl);
    if (!this.isYouTube(parsed)) {
      yield* this.runFfmpeg(['-i', rawUrl], signal);
      return;
    }
    const directUrl = await this.resolveYoutubeDirectUrl(rawUrl, signal);
    if (signal.aborted) {
      return;
    }
    const live = await this.isLiveStream(rawUrl, signal);
    if (signal.aborted) {
      return;
    }
    yield* this.runFfmpeg(['-i', directUrl], signal, { realtimeOverride: !live });
  }

  private validateUrl(rawUrl: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`Invalid audio source URL: "${rawUrl}"`);
    }
    if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(
        `Unsupported URL scheme "${parsed.protocol}" for "${rawUrl}" (allowed: http, https, rtmp, srt)`,
      );
    }
    return parsed;
  }

  private isYouTube(url: URL): boolean {
    return YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
  }

  /** `yt-dlp -f bestaudio -g <url>` resolves a YouTube page to a direct, ffmpeg-readable URL. */
  private async resolveYoutubeDirectUrl(rawUrl: string, signal: AbortSignal): Promise<string> {
    const output = await this.runToCompletion('yt-dlp', ['-f', 'bestaudio', '-g', rawUrl], signal);
    const directUrl = output.split('\n')[0]?.trim();
    if (!directUrl) {
      throw new Error(`yt-dlp did not return a direct URL for "${rawUrl}"`);
    }
    return directUrl;
  }

  private async isLiveStream(rawUrl: string, signal: AbortSignal): Promise<boolean> {
    const output = await this.runToCompletion(
      'yt-dlp',
      ['--no-warnings', '--print', 'is_live', rawUrl],
      signal,
    );
    return output.trim().toLowerCase() === 'true';
  }

  private runToCompletion(command: string, args: string[], signal: AbortSignal): Promise<string> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf8');
      });
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf8');
      });
      child.once('error', rejectPromise);
      child.once('exit', (code) => {
        if (code === 0) {
          resolvePromise(stdout);
        } else {
          rejectPromise(new Error(`${command} exited with code ${String(code)}: ${stderr.trim()}`));
        }
      });
    });
  }

  /** Runs ffmpeg and yields fixed 100 ms / 3200-byte PCM chunks with an accumulated `offsetMs`. */
  private async *runFfmpeg(
    inputArgs: string[],
    signal: AbortSignal,
    options?: { realtimeOverride?: boolean },
  ): AsyncGenerator<AudioChunk> {
    if (signal.aborted) {
      return;
    }

    const useRealtime = options?.realtimeOverride ?? this.realtime;
    const args = [
      ...(useRealtime ? ['-re'] : []),
      ...inputArgs,
      '-f',
      's16le',
      '-ac',
      String(AUDIO_FORMAT.channels),
      '-ar',
      String(AUDIO_FORMAT.sampleRate),
      '-hide_banner',
      '-loglevel',
      'error',
      'pipe:1',
    ];

    // Node kills the process (SIGTERM by default) as soon as `signal` aborts.
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    const stdout = child.stdout;
    if (!stdout) {
      throw new Error('ffmpeg spawned without a stdout stream');
    }

    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf8');
    });

    const exitPromise = new Promise<FfmpegExitResult>((resolveExit) => {
      child.once('error', (error) => resolveExit({ code: null, error }));
      child.once('exit', (code) => resolveExit({ code }));
    });

    let buffer = Buffer.alloc(0);
    let offsetMs = 0;
    for await (const data of stdout as AsyncIterable<Buffer>) {
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= CHUNK_BYTES) {
        const slice = buffer.subarray(0, CHUNK_BYTES);
        buffer = buffer.subarray(CHUNK_BYTES);
        yield { data: new Uint8Array(slice), offsetMs, durationMs: CHUNK_DURATION_MS };
        offsetMs += CHUNK_DURATION_MS;
      }
    }
    if (!signal.aborted && buffer.length > 0) {
      yield {
        data: new Uint8Array(buffer),
        offsetMs,
        durationMs: Math.round((buffer.length / CHUNK_BYTES) * CHUNK_DURATION_MS),
      };
    }

    const result = await exitPromise;
    if (!signal.aborted) {
      if (result.error) {
        throw new Error(`ffmpeg failed to start: ${result.error.message}`);
      }
      if (result.code !== 0 && result.code !== null) {
        throw new Error(`ffmpeg exited with code ${String(result.code)}: ${stderr.trim()}`);
      }
    }
  }
}
