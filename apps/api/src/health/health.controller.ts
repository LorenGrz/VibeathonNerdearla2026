import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get()
  check(): { ok: true; transcriber: Env['TRANSCRIBER'] } {
    return { ok: true, transcriber: this.config.get('TRANSCRIBER', { infer: true }) };
  }
}
