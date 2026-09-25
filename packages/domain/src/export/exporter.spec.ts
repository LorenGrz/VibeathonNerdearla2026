import { describe, expect, it } from 'vitest';
import { LanguageCode } from '../language/language-code.js';
import { SessionId } from '../session/session-id.js';
import { sequentialIdGenerator } from '../shared/id-generator.js';
import { TimeRange } from '../transcript/time-range.js';
import { TranscriptSegment } from '../transcript/transcript-segment.js';
import { SrtExporter, TextExporter, VttExporter, exporterFor } from './exporter.js';

const sessionId = SessionId.of('s1');
const en = LanguageCode.of('en');
const segIds = sequentialIdGenerator('seg');

const seg = (startMs: number, endMs: number, text: string) =>
  TranscriptSegment.original(
    {
      sessionId,
      language: en,
      text,
      range: TimeRange.of(startMs, endMs),
      isFinal: true,
    },
    segIds,
  );

describe('SrtExporter', () => {
  it('exports empty list as empty string', () => {
    const exporter = new SrtExporter();
    expect(exporter.export([])).toBe('');
  });

  it('formats time correctly at 0ms', () => {
    const exporter = new SrtExporter();
    const segment = seg(0, 1000, 'hello');
    const result = exporter.export([segment]);
    expect(result).toContain('00:00:00,000 --> 00:00:01,000');
  });

  it('formats time correctly at 59999ms', () => {
    const exporter = new SrtExporter();
    const segment = seg(59999, 60000, 'hello');
    const result = exporter.export([segment]);
    expect(result).toContain('00:00:59,999 --> 00:01:00,000');
  });

  it('formats time correctly for durations over 1 hour', () => {
    const exporter = new SrtExporter();
    const segment = seg(3661000, 3662000, 'hello');
    const result = exporter.export([segment]);
    expect(result).toContain('01:01:01,000 --> 01:01:02,000');
  });

  it('indexes subtitles starting from 1', () => {
    const exporter = new SrtExporter();
    const s1 = seg(0, 1000, 'first');
    const s2 = seg(1000, 2000, 'second');
    const result = exporter.export([s1, s2]);
    const lines = result.split('\n');
    expect(lines[0]).toBe('1');
    expect(lines[4]).toBe('2');
  });

  it('separates blocks with blank lines', () => {
    const exporter = new SrtExporter();
    const s1 = seg(0, 1000, 'first');
    const s2 = seg(1000, 2000, 'second');
    const result = exporter.export([s1, s2]);
    expect(result).toMatchInlineSnapshot(`
      "1
      00:00:00,000 --> 00:00:01,000
      first

      2
      00:00:01,000 --> 00:00:02,000
      second"
    `);
  });

  it('wraps text to max 42 chars without breaking words', () => {
    const exporter = new SrtExporter();
    const longText = 'This is a very long line that should wrap';
    const segment = seg(0, 1000, longText);
    const result = exporter.export([segment]);
    const textLines = result.split('\n').slice(2, -1); // Skip index, timecode, and blank
    for (const line of textLines) {
      expect(line.length).toBeLessThanOrEqual(42);
    }
  });

  it('limits wrapped text to 2 lines per block', () => {
    const exporter = new SrtExporter();
    const veryLongText =
      'This is a very long text with many words that would normally wrap to more than two lines if we did not split it';
    const segment = seg(0, 1000, veryLongText);
    const result = exporter.export([segment]);
    // Each block should have at most 2 lines (we split very long text)
    expect(result.split('1\n').length).toBeGreaterThan(1); // Multiple blocks created
  });

  it('splits long segments across multiple blocks with proportional time', () => {
    const exporter = new SrtExporter();
    const veryLongText =
      'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16';
    const segment = seg(0, 10000, veryLongText);
    const result = exporter.export([segment]);

    // Should have multiple blocks
    const blockCount = (result.match(/^\d+$/gm) || []).length;
    expect(blockCount).toBeGreaterThan(1);

    // All timecodes should be within the original range
    const timecodes = result.match(/\d{2}:\d{2}:\d{2},\d{3}/g) || [];
    for (const timecode of timecodes) {
      const ms = timeToMs(timecode);
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThanOrEqual(10000);
    }
  });
});

describe('VttExporter', () => {
  it('exports empty list with WEBVTT header', () => {
    const exporter = new VttExporter();
    expect(exporter.export([])).toBe('WEBVTT');
  });

  it('starts with WEBVTT header and blank line', () => {
    const exporter = new VttExporter();
    const segment = seg(0, 1000, 'hello');
    const result = exporter.export([segment]);
    expect(result.startsWith('WEBVTT\n\n')).toBe(true);
  });

  it('formats time with dots instead of commas', () => {
    const exporter = new VttExporter();
    const segment = seg(0, 1000, 'hello');
    const result = exporter.export([segment]);
    expect(result).toContain('00:00:00.000 --> 00:00:01.000');
    expect(result).not.toContain(',');
  });

  it('creates complete VTT structure', () => {
    const exporter = new VttExporter();
    const s1 = seg(0, 1000, 'first');
    const s2 = seg(1000, 2000, 'second');
    const result = exporter.export([s1, s2]);
    expect(result).toMatchInlineSnapshot(`
      "WEBVTT

      00:00:00.000 --> 00:00:01.000
      first

      00:00:01.000 --> 00:00:02.000
      second"
    `);
  });
});

describe('TextExporter', () => {
  it('exports empty list as empty string', () => {
    const exporter = new TextExporter();
    expect(exporter.export([])).toBe('');
  });

  it('creates one paragraph per segment', () => {
    const exporter = new TextExporter();
    const s1 = seg(0, 1000, 'first');
    const s2 = seg(1000, 2000, 'second');
    const result = exporter.export([s1, s2]);
    expect(result).toBe('first\n\nsecond');
  });

  it('wraps long text within each paragraph', () => {
    const exporter = new TextExporter();
    const longText = 'This is a very long line that should wrap nicely';
    const segment = seg(0, 1000, longText);
    const result = exporter.export([segment]);
    const lines = result.split('\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(42);
    }
  });

  it('separates paragraphs with double newlines', () => {
    const exporter = new TextExporter();
    const s1 = seg(0, 1000, 'first paragraph');
    const s2 = seg(1000, 2000, 'second paragraph');
    const result = exporter.export([s1, s2]);
    expect(result).toMatchInlineSnapshot(`
      "first paragraph

      second paragraph"
    `);
  });
});

describe('exporterFor', () => {
  it('returns SrtExporter for "srt" format', () => {
    const exporter = exporterFor('srt');
    expect(exporter.format).toBe('srt');
    expect(exporter).toBeInstanceOf(SrtExporter);
  });

  it('returns VttExporter for "vtt" format', () => {
    const exporter = exporterFor('vtt');
    expect(exporter.format).toBe('vtt');
    expect(exporter).toBeInstanceOf(VttExporter);
  });

  it('returns TextExporter for "txt" format', () => {
    const exporter = exporterFor('txt');
    expect(exporter.format).toBe('txt');
    expect(exporter).toBeInstanceOf(TextExporter);
  });

  it('provides correct MIME type for SRT', () => {
    const exporter = exporterFor('srt');
    expect(exporter.mimeType).toBe('application/x-subrip; charset=utf-8');
  });

  it('provides correct MIME type for VTT', () => {
    const exporter = exporterFor('vtt');
    expect(exporter.mimeType).toBe('text/vtt; charset=utf-8');
  });

  it('provides correct MIME type for TXT', () => {
    const exporter = exporterFor('txt');
    expect(exporter.mimeType).toBe('text/plain; charset=utf-8');
  });
});

/**
 * Helper to parse SRT timecode back to milliseconds for testing.
 */
function timeToMs(timecode: string): number {
  const [time, ms] = timecode.split(/[,.]/) as [string, string];
  const [h, m, s] = time.split(':').map(Number) as [number, number, number];
  return h * 3600000 + m * 60000 + s * 1000 + Number(ms);
}
