import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');
  const origins = config
    .get('WEB_ORIGIN', { infer: true })
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: origins });
  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
