import { describe, expect, it } from 'vitest';
import { collectStreamedFgaObjects } from './collect-streamed-fga-objects.helper';

describe('collectStreamedFgaObjects', () => {
  it('collects all objects from an async generator', async () => {
    async function* gen() {
      yield { object: 'administration:abc' };
      yield { object: 'administration:def' };
      yield { object: 'administration:ghi' };
    }

    const result = await collectStreamedFgaObjects(gen());

    expect(result).toEqual(['administration:abc', 'administration:def', 'administration:ghi']);
  });

  it('returns an empty array for an empty generator', async () => {
    async function* gen() {
      // intentionally yields nothing
    }

    const result = await collectStreamedFgaObjects(gen());

    expect(result).toEqual([]);
  });

  it('propagates errors from the generator', async () => {
    async function* gen() {
      yield { object: 'administration:abc' };
      throw new Error('stream failed');
    }

    await expect(collectStreamedFgaObjects(gen())).rejects.toThrow('stream failed');
  });
});
