import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { TranscriberPort, TranscriberStream } from '@subs/domain';
import { TRANSCRIBER } from '../shared/tokens.js';
import { GeminiChunkedTranscriber } from './gemini-chunked.transcriber.js';
import { GeminiLiveTranscriber } from './gemini-live.transcriber.js';
import { TranscriptionModule, resolveLiveModel } from './transcription.module.js';

class StubMockTranscriber implements TranscriberPort {
  open(): Promise<TranscriberStream> {
    return Promise.reject(new Error('not used'));
  }
}

async function resolveTranscriber(
  env: Record<string, string>,
  options?: Parameters<typeof TranscriptionModule.register>[0],
): Promise<TranscriberPort> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }),
      TranscriptionModule.register(options),
    ],
  }).compile();
  return moduleRef.get<TranscriberPort>(TRANSCRIBER);
}

const gemini = { GEMINI_API_KEY: 'test-key', GEMINI_TEXT_MODEL: 'gemini-2.5-flash' };

describe('TranscriptionModule', () => {
  it('provides GeminiLiveTranscriber for TRANSCRIBER=live', async () => {
    const transcriber = await resolveTranscriber({
      ...gemini,
      TRANSCRIBER: 'live',
      GEMINI_LIVE_MODEL: 'gemini-3.5-transcribe-live',
    });
    expect(transcriber).toBeInstanceOf(GeminiLiveTranscriber);
  });

  it('provides GeminiChunkedTranscriber for TRANSCRIBER=chunked', async () => {
    const transcriber = await resolveTranscriber({ ...gemini, TRANSCRIBER: 'chunked' });
    expect(transcriber).toBeInstanceOf(GeminiChunkedTranscriber);
  });

  it('uses the registered mock class for TRANSCRIBER=mock', async () => {
    const transcriber = await resolveTranscriber(
      { TRANSCRIBER: 'mock' },
      { mock: StubMockTranscriber },
    );
    expect(transcriber).toBeInstanceOf(StubMockTranscriber);
  });

  it('fails clearly when TRANSCRIBER=mock has no registered mock', async () => {
    await expect(resolveTranscriber({ TRANSCRIBER: 'mock' })).rejects.toThrow(
      /register\(\{ mock: MockTranscriber \}\)/,
    );
  });

  it('replaces shut-down live model ids with the current transcribe model', () => {
    const warn = vi.fn();
    expect(resolveLiveModel('gemini-live-2.5-flash-preview', { warn })).toBe(
      'gemini-3.5-transcribe-live',
    );
    expect(warn).toHaveBeenCalledOnce();
    expect(resolveLiveModel('gemini-3.8-live')).toBe('gemini-3.8-live');
  });
});
