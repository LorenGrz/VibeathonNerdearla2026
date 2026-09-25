import { AsyncQueue } from './async-queue.js';

describe('AsyncQueue', () => {
  it('delivers buffered and awaited items, then ends', async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    const collected = (async () => {
      const out: number[] = [];
      for await (const n of queue) out.push(n);
      return out;
    })();
    await Promise.resolve();
    queue.push(2);
    queue.end();
    queue.push(3); // ignored after end

    expect(await collected).toEqual([1, 2]);
  });

  it('delivers buffered items before surfacing a failure', async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.fail(new Error('boom'));
    const out: number[] = [];
    await expect(
      (async () => {
        for await (const n of queue) out.push(n);
      })(),
    ).rejects.toThrow('boom');
    expect(out).toEqual([1]);
  });
});
