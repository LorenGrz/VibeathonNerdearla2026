import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { SamplesController } from './samples.controller.js';

function configServiceFor(samplesDir: string): ConfigService<Env, true> {
  return { get: () => samplesDir } as unknown as ConfigService<Env, true>;
}

describe('SamplesController', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'livesubs-samples-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('lists audio files in SAMPLES_DIR, sorted, ignoring non-audio files', async () => {
    await writeFile(join(dir, 'b-talk.mp3'), '');
    await writeFile(join(dir, 'a-talk.wav'), '');
    await writeFile(join(dir, 'notes.txt'), '');

    const controller = new SamplesController(configServiceFor(dir));

    await expect(controller.list()).resolves.toEqual(['a-talk.wav', 'b-talk.mp3']);
  });

  it('returns an empty list when SAMPLES_DIR has no audio files', async () => {
    const controller = new SamplesController(configServiceFor(dir));

    await expect(controller.list()).resolves.toEqual([]);
  });
});
