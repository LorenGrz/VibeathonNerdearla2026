#!/usr/bin/env bash
set -euo pipefail

# Downloads ~90s clips from two past Nerdearla talks on YouTube and trims/transcodes them to
# mono 64 kbps mp3 for use as demo audio sources (samples/en-nerdearla.mp3, samples/es-nerdearla.mp3).
#
# TODO(Loren): confirm these URLs point at an EN and an ES Nerdearla talk before running this
# script. They are placeholders picked for illustration only.
EN_TALK_URL="https://www.youtube.com/watch?v=REPLACE_WITH_EN_TALK_ID"
ES_TALK_URL="https://www.youtube.com/watch?v=REPLACE_WITH_ES_TALK_ID"

CLIP_DURATION_SECONDS=90
AUDIO_BITRATE="64k"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLES_DIR="${SCRIPT_DIR}/../samples"

fetch_clip() {
  local url="$1"
  local out_file="$2"
  local tmp_file
  tmp_file="$(mktemp -d)/source.%(ext)s"

  yt-dlp -f bestaudio -o "${tmp_file}" "${url}"

  local downloaded
  downloaded="$(dirname "${tmp_file}")"/$(ls "$(dirname "${tmp_file}")")

  ffmpeg -y -i "${downloaded}" -t "${CLIP_DURATION_SECONDS}" -ac 1 -b:a "${AUDIO_BITRATE}" "${out_file}"

  rm -rf "$(dirname "${tmp_file}")"
}

mkdir -p "${SAMPLES_DIR}"
fetch_clip "${EN_TALK_URL}" "${SAMPLES_DIR}/en-nerdearla.mp3"
fetch_clip "${ES_TALK_URL}" "${SAMPLES_DIR}/es-nerdearla.mp3"

echo "Done. Update samples/README.md with the source URLs and license of each clip."
