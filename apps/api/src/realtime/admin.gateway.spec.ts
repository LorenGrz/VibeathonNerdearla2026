import type { Session, SessionRepository } from '@subs/domain';
import type { Server } from 'socket.io';
import { AdminGateway } from './admin.gateway.js';

describe('AdminGateway', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits sessions:snapshot every second while running', async () => {
    const emit = vi.fn();
    const snapshot = { id: 's-1', status: 'idle' };
    const session = { toSnapshot: () => snapshot } as unknown as Session;
    const sessions: SessionRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn().mockResolvedValue([session]),
      delete: vi.fn(),
    };
    const gateway = new AdminGateway(sessions);
    gateway.server = { emit } as unknown as Server;

    gateway.onModuleInit();
    await vi.advanceTimersByTimeAsync(1000);

    expect(emit).toHaveBeenCalledWith('sessions:snapshot', [snapshot]);

    gateway.onModuleDestroy();
    emit.mockClear();
    await vi.advanceTimersByTimeAsync(2000);
    expect(emit).not.toHaveBeenCalled();
  });
});
