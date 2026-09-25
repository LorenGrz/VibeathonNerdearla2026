import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AUDIO_SOURCE } from '../shared/tokens.js';
import { CompositeAudioSource } from './composite-audio-source.js';
import { FfmpegAudioSource } from './ffmpeg-audio-source.js';
import { MicAudioSource } from './mic-audio-source.js';
import { MicGateway } from './mic.gateway.js';
import { SamplesController } from './samples.controller.js';

/**
 * Provides `AUDIO_SOURCE` (`CompositeAudioSource`: file/url -> ffmpeg, mic -> `MicAudioSource`),
 * the `/mic` gateway that feeds `MicAudioSource`, and `GET /api/samples`.
 * `ConfigModule` and `SESSION_REPOSITORY` (PersistenceModule) are global.
 */
@Module({
  controllers: [SamplesController],
  providers: [
    { provide: MicAudioSource, useFactory: () => new MicAudioSource() },
    MicGateway,
    {
      provide: AUDIO_SOURCE,
      useFactory: (config: ConfigService<Env, true>, mic: MicAudioSource) =>
        new CompositeAudioSource(
          new FfmpegAudioSource({ samplesDir: config.get('SAMPLES_DIR', { infer: true }) }),
          mic,
        ),
      inject: [ConfigService, MicAudioSource],
    },
  ],
  exports: [AUDIO_SOURCE],
})
export class IngestModule {}
