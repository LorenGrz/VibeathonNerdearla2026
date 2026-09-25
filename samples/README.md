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

## `en-nerdearla.mp3` / `es-nerdearla.mp3` (not yet fetched)

~90 s clips from past Nerdearla conference talks (one EN, one ES), trimmed and transcoded to
mono 64 kbps mp3 by `scripts/fetch-samples.sh`. That script currently has placeholder YouTube
URLs — **TODO(Loren): confirm the actual talk URLs and their license/attribution before
running it and committing the resulting files.**
