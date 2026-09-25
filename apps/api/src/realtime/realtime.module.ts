import { Module } from '@nestjs/common';
import { EVENT_PUBLISHER } from '../shared/tokens.js';
import { AdminGateway } from './admin.gateway.js';
import { CaptionsGateway } from './captions.gateway.js';
import { SocketIoEventPublisher } from './socket-io-event-publisher.js';

/**
 * Integrator note: `CaptionsGateway`, `AdminGateway` and `SocketIoEventPublisher` inject
 * `SESSION_REPOSITORY` and `TRANSCRIPT_REPOSITORY` (see `apps/api/src/shared/tokens.ts`)
 * but this module does not provide them. Make those tokens available in this module's
 * injector context (e.g. a `@Global()` persistence module from T3), or add them to this
 * module's `imports`.
 *
 * This module also requires a Socket.IO adapter to be set on the Nest application, e.g.
 * `app.useWebSocketAdapter(new IoAdapter(app))` from `@nestjs/platform-socket.io`, before
 * `app.listen()` — otherwise gateways cannot bind their namespaces. That call belongs in
 * `main.ts` / the e2e test bootstrap, out of this module's scope.
 *
 * Provides and exports `EVENT_PUBLISHER` (`SocketIoEventPublisher`).
 */
@Module({
  providers: [
    CaptionsGateway,
    AdminGateway,
    SocketIoEventPublisher,
    { provide: EVENT_PUBLISHER, useExisting: SocketIoEventPublisher },
  ],
  exports: [EVENT_PUBLISHER],
})
export class RealtimeModule {}
