import { Inject, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { WS_NAMESPACE_ADMIN, type SessionRepository } from '@subs/domain';
import type { Server } from 'socket.io';
import { SESSION_REPOSITORY } from '../shared/tokens.js';

const SNAPSHOT_INTERVAL_MS = 1000;

/**
 * Requires `SESSION_REPOSITORY` to be available in this module's injector context
 * (see `RealtimeModule` for the integrator note).
 */
@WebSocketGateway({ namespace: WS_NAMESPACE_ADMIN, cors: { origin: true, credentials: true } })
export class AdminGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;

  private interval?: NodeJS.Timeout;

  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository) {}

  onModuleInit(): void {
    this.interval = setInterval(() => {
      void this.broadcastSnapshot();
    }, SNAPSHOT_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async broadcastSnapshot(): Promise<void> {
    const sessions = await this.sessions.findAll();
    this.server.emit(
      'sessions:snapshot',
      sessions.map((session) => session.toSnapshot()),
    );
  }
}
