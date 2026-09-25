import {
  LanguageCode,
  SessionId,
  TimeRange,
  TranscriptSegment,
  sequentialIdGenerator,
} from '@subs/domain';
import { srtExporter } from './srt.exporter.js';
import { vttExporter } from './vtt.exporter.js';
import { txtExporter } from './txt.exporter.js';
import { createTranscriptExporters } from './index.js';

const buildSegments = () => {
  const ids = sequentialIdGenerator('seg');
  const sessionId = SessionId.create(sequentialIdGenerator('session'));
  const language = LanguageCode.of('es');
  return [
    TranscriptSegment.original(
      { sessionId, language, text: 'Hola', range: TimeRange.of(0, 1500), isFinal: true },
      ids,
    ),
    TranscriptSegment.original(
      { sessionId, language, text: 'Mundo', range: TimeRange.of(1500, 3000), isFinal: true },
      ids,
    ),
  ];
};

describe('srtExporter', () => {
  it('formats segments as numbered SRT cues', () => {
    const output = srtExporter.export(buildSegments());
    expect(output).toBe(
      [
        '1',
        '00:00:00,000 --> 00:00:01,500',
        'Hola',
        '',
        '2',
        '00:00:01,500 --> 00:00:03,000',
        'Mundo',
      ].join('\n'),
    );
  });
});

describe('vttExporter', () => {
  it('formats segments as WebVTT cues with a header', () => {
    const output = vttExporter.export(buildSegments());
    expect(output.startsWith('WEBVTT\n\n')).toBe(true);
    expect(output).toContain('00:00:00.000 --> 00:00:01.500\nHola');
  });
});

describe('txtExporter', () => {
  it('joins segment text with newlines', () => {
    expect(txtExporter.export(buildSegments())).toBe('Hola\nMundo');
  });
});

describe('createTranscriptExporters', () => {
  it('exposes srt, vtt and txt exporters', () => {
    const exporters = createTranscriptExporters();
    expect(Object.keys(exporters).sort()).toEqual(['srt', 'txt', 'vtt']);
    expect(exporters.srt.mimeType).toBe('application/x-subrip');
    expect(exporters.vtt.mimeType).toBe('text/vtt');
    expect(exporters.txt.mimeType).toBe('text/plain');
  });
});
