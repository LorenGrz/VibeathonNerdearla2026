# Samples

Audio fixtures used for local demos and tests. Served by `GET /api/samples` and read by
`FfmpegAudioSource` when a session's source is `{ kind: 'file', path: '<name>' }`.

## `tone-2s.mp3`

Synthetic 440 Hz sine tone, 2 seconds, mono, 64 kbps. Generated locally, no external license:

```sh
ffmpeg -f lavfi -i sine=frequency=440:duration=2 -ac 1 -b:a 64k samples/tone-2s.mp3
```

Used by `apps/api/src/ingest/ffmpeg-audio-source.spec.ts` to assert fixed-size chunking and
abort behaviour without depending on a real recording.

## `en-nerdearla.mp3` / `es-nerdearla.mp3` (generated, not committed)

~90 s clips of two talks from the official Nerdearla YouTube channel, trimmed and transcoded
to mono 64 kbps mp3 by `scripts/fetch-samples.sh`:

| File | Talk | Speaker |
|---|---|---|
| `en-nerdearla.mp3` | [Model Context Protocol in Plain English](https://www.youtube.com/watch?v=iaG9pHMJ3Y4) | Nate Barbettini |
| `es-nerdearla.mp3` | [No sos Netflix](https://www.youtube.com/watch?v=nGeiH6GSIuU) | J. Rodríguez Monti |

All rights belong to the speakers and Nerdearla. They are git-ignored; run
`bash scripts/fetch-samples.sh` (needs `yt-dlp` and `ffmpeg`) to create them.
