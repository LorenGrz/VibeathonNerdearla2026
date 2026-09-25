import type { ExportFormat } from '../contracts/dto.js';
import type { TranscriptSegment } from '../transcript/transcript-segment.js';
import type { TimeRange } from '../transcript/time-range.js';
import { TimeRange as TimeRangeClass } from '../transcript/time-range.js';

export interface TranscriptExporter {
  readonly format: ExportFormat;
  readonly mimeType: string;
  export(segments: readonly TranscriptSegment[]): string;
}

/**
 * Formats milliseconds as HH:MM:SS.mmm (for VTT) or HH:MM:SS,mmm (for SRT).
 */
function formatTime(ms: number, separator: '.' | ','): string {
  const totalSeconds = Math.floor(ms / 1000);
  const millis = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number, length: number): string => String(n).padStart(length, '0');
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${separator}${pad(millis, 3)}`;
}

/**
 * Splits text into lines of max 42 characters without breaking words.
 * Returns both the lines (up to maxLines) and whether there are remaining words.
 */
function wrapText(
  text: string,
  maxCharsPerLine: number = 42,
  maxLines: number = 2,
): { lines: string[]; hasMoreWords: boolean } {
  if (!text) return { lines: [], hasMoreWords: false };

  const allWords = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of allWords) {
    if (lines.length >= maxLines) {
      // Already at max lines, stop adding
      return { lines, hasMoreWords: true };
    }

    if (!currentLine) {
      // Starting a new line
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
      // Word fits on current line
      currentLine += ' ' + word;
    } else {
      // Word doesn't fit; start a new line
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return { lines, hasMoreWords: false };
}

/**
 * Splits a segment into multiple segments if its text doesn't fit in 2 lines of 42 chars.
 * Divides the time range proportionally based on the number of lines needed.
 */
function splitSegmentIfNeeded(
  segment: TranscriptSegment,
): Array<{ text: string; range: TimeRange }> {
  const wrapped = wrapText(segment.text);

  if (!wrapped.hasMoreWords) {
    // Fits in 2 lines, no split needed
    return [{ text: wrapped.lines.join('\n'), range: segment.range }];
  }

  // Need to split the segment
  const result: Array<{ text: string; range: TimeRange }> = [];
  const totalDuration = segment.range.durationMs();
  const totalWords = segment.text.split(/\s+/).length;
  const wordsPerBlock = Math.max(1, Math.ceil(totalWords / 2)); // At least 2 blocks

  const currentWords = segment.text.split(/\s+/);
  let processedDuration = 0;

  while (currentWords.length > 0) {
    const blockWords = currentWords.splice(0, wordsPerBlock);
    const blockText = blockWords.join(' ');

    // Calculate time proportionally
    const wordsPercentage = blockWords.length / totalWords;
    const blockDuration = Math.floor(totalDuration * wordsPercentage);

    const blockStartMs = segment.range.startMs + processedDuration;
    const blockEndMs = currentWords.length > 0 ? blockStartMs + blockDuration : segment.range.endMs; // Last block gets remaining time

    const blockWrapped = wrapText(blockText);
    result.push({
      text: blockWrapped.lines.join('\n'),
      range: TimeRangeClass.of(blockStartMs, blockEndMs),
    });

    processedDuration += blockDuration;
  }

  return result;
}

export class SrtExporter implements TranscriptExporter {
  readonly format: ExportFormat = 'srt';
  readonly mimeType = 'text/plain; charset=utf-8';

  export(segments: readonly TranscriptSegment[]): string {
    if (segments.length === 0) return '';

    const lines: string[] = [];
    let index = 1;

    for (const segment of segments) {
      const blocks = splitSegmentIfNeeded(segment);

      for (const block of blocks) {
        lines.push(String(index));
        lines.push(
          `${formatTime(block.range.startMs, ',')} --> ${formatTime(block.range.endMs, ',')}`,
        );
        lines.push(block.text);
        lines.push(''); // blank line

        index++;
      }
    }

    // Remove trailing blank line
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.join('\n');
  }
}

export class VttExporter implements TranscriptExporter {
  readonly format: ExportFormat = 'vtt';
  readonly mimeType = 'text/vtt; charset=utf-8';

  export(segments: readonly TranscriptSegment[]): string {
    if (segments.length === 0) return 'WEBVTT';

    const lines: string[] = ['WEBVTT', ''];

    for (const segment of segments) {
      const blocks = splitSegmentIfNeeded(segment);

      for (const block of blocks) {
        lines.push(
          `${formatTime(block.range.startMs, '.')} --> ${formatTime(block.range.endMs, '.')}`,
        );
        lines.push(block.text);
        lines.push('');
      }
    }

    // Remove trailing blank line
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.join('\n');
  }
}

export class TextExporter implements TranscriptExporter {
  readonly format: ExportFormat = 'txt';
  readonly mimeType = 'text/plain; charset=utf-8';

  export(segments: readonly TranscriptSegment[]): string {
    if (segments.length === 0) return '';

    const paragraphs: string[] = [];

    for (const segment of segments) {
      const blocks = splitSegmentIfNeeded(segment);

      for (const block of blocks) {
        paragraphs.push(block.text);
      }
    }

    return paragraphs.join('\n\n');
  }
}

export function exporterFor(format: ExportFormat): TranscriptExporter {
  switch (format) {
    case 'srt':
      return new SrtExporter();
    case 'vtt':
      return new VttExporter();
    case 'txt':
      return new TextExporter();
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}
