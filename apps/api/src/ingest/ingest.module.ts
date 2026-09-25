import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AUDIO_SOURCE } from '../shared/tokens.js';
import { FfmpegAudioSource } from './ffmpeg-audio-source.js';
import { SamplesController } from './samples.controller.js';

/** Provides `AUDIO_SOURCE` (`FfmpegAudioSource`) and `GET /api/samples`. `ConfigModule` is global. */
@Module({
  controllers: [SamplesController],
  providers: [
    {
      provide: AUDIO_SOURCE,
      useFactory: (config: ConfigService<Env, true>) =>
        new FfmpegAudioSource({ samplesDir: config.get('SAMPLES_DIR', { infer: true }) }),
      inject: [ConfigService],
    },
  ],
  exports: [AUDIO_SOURCE],
})
export class IngestModule {}
