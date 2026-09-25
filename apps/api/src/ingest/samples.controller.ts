import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import type { Env } from '../config/env.js';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac']);

@Controller('samples')
export class SamplesController {
  private readonly samplesDir: string;

  constructor(config: ConfigService<Env, true>) {
    this.samplesDir = resolve(process.cwd(), config.get('SAMPLES_DIR', { infer: true }));
  }

  @Get()
  async list(): Promise<string[]> {
    const entries = await readdir(this.samplesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort();
  }
}
