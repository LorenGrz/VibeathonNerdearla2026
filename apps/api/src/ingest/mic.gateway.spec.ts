import type { Session, SessionRepository } from '@subs/domain';
import type { Socket } from 'socket.io';
import { MicAudioSource } from './mic-audio-source.js';
import { MicGateway } from './mic.gateway.js';

function fakeSocket(id: string) {
  const emit = vi.fn();
  return { socket: { id, data: {}, emit } as unknown as Socket, emit };
}

function repoWith(sessions: Record<string, Session['source']>): SessionRepository {
  return {
    save: vi.fn(),
    findById: vi.fn((id: { value: string }) => {
      const source = sessions[id.value];
      return Promise.resolve(source ? ({ source } as unknown as Session) : null);
    }),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
}

describe('MicGateway', () => {
  const setup = () => {
    const mic = new MicAudioSource();
    const gateway = new MicGateway(
      mic,
      repoWith({ 'mic-1': { kind: 'mic' }, 'file-1': { kind: 'file', path: 'a.mp3' } }),
    );
    return { mic, gateway };
  };

  it('claims the session and forwards binary chunks from the owner', async () => {
    const { mic, gateway } = setup();
    const a = fakeSocket('a');
    const push = vi.spyOn(mic, 'push');

    await gateway.handleStart(a.socket, { sessionId: 'mic-1' });
    expect(a.emit).toHaveBeenCalledWith('mic:started', { sessionId: 'mic-1' });

    const buffer = new ArrayBuffer(3200);
    gateway.handleChunk(a.socket, Buffer.from(buffer));
    expect(push).toHaveBeenCalledWith('mic-1', 'a', expect.any(Uint8Array));
  });

  it('rejects a second emitter for the same session', async () => {
    const { mic, gateway } = setup();
    const a = fakeSocket('a');
    const b = fakeSocket('b');
    await gateway.handleStart(a.socket, { sessionId: 'mic-1' });
    await gateway.handleStart(b.socket, { sessionId: 'mic-1' });

    expect(b.emit).toHaveBeenCalledWith('mic:error', {
      message: expect.stringMatching(/already has an active microphone/) as string,
    });
    const push = vi.spyOn(mic, 'push');
    gateway.handleChunk(b.socket, new ArrayBuffer(3200));
    expect(push).not.toHaveBeenCalled();
    expect(mic.emitterOf('mic-1')).toBe('a');
  });

  it('frees the session on mic:stop and on disconnect', async () => {
    const { mic, gateway } = setup();
    const a = fakeSocket('a');
    await gateway.handleStart(a.socket, { sessionId: 'mic-1' });
    gateway.handleStop(a.socket);
    expect(a.emit).toHaveBeenCalledWith('mic:stopped', { sessionId: 'mic-1' });
    expect(mic.emitterOf('mic-1')).toBeUndefined();

    const b = fakeSocket('b');
    await gateway.handleStart(b.socket, { sessionId: 'mic-1' });
    gateway.handleDisconnect(b.socket);
    expect(mic.emitterOf('mic-1')).toBeUndefined();
  });

  it.each([
    [{ sessionId: 'missing' }, /not found/],
    [{ sessionId: 'file-1' }, /does not use a microphone/],
    [undefined, /requires \{ sessionId \}/],
  ])('rejects mic:start %j', async (payload, message) => {
    const { mic, gateway } = setup();
    const a = fakeSocket('a');
    await gateway.handleStart(a.socket, payload as { sessionId: string } | undefined);
    expect(a.emit).toHaveBeenCalledWith('mic:error', {
      message: expect.stringMatching(message) as string,
    });
    expect(mic.emitterOf('file-1')).toBeUndefined();
  });

  it('ignores chunks before mic:start and rejects non-binary chunks', async () => {
    const { mic, gateway } = setup();
    const a = fakeSocket('a');
    const push = vi.spyOn(mic, 'push');
    gateway.handleChunk(a.socket, new ArrayBuffer(3200));
    expect(push).not.toHaveBeenCalled();

    await gateway.handleStart(a.socket, { sessionId: 'mic-1' });
    gateway.handleChunk(a.socket, 'not-binary');
    expect(a.emit).toHaveBeenCalledWith('mic:error', {
      message: expect.stringMatching(/binary/) as string,
    });
    expect(push).not.toHaveBeenCalled();
  });
});
