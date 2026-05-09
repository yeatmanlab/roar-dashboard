import { describe, expect, it, vi } from 'vitest';
import { collectStreamedFgaObjects, withFgaFilterIds } from './fga-filter-ids.utils';

describe('withFgaFilterIds', () => {
  /**
   * Helper that simulates the minimal Drizzle surface withFgaFilterIds needs:
   * `db.transaction(callback)` and a `tx.execute(...)` method that records the
   * SQL fragments it received. Returning a `tx`-like object lets the unit test
   * run without a real Postgres connection.
   */
  interface FakeTx {
    execute: ReturnType<typeof vi.fn>;
  }

  function createFakeDb() {
    const executeCalls: { sql: string; params: unknown[] }[] = [];
    const tx: FakeTx = {
      execute: vi.fn(async (query: { queryChunks?: unknown[] }) => {
        // Best-effort string capture for assertions; the real Drizzle SQL object
        // exposes queryChunks but here we only need to know that execute fired.
        executeCalls.push({
          sql: JSON.stringify(query?.queryChunks ?? query),
          params: [],
        });
        return undefined;
      }),
    };

    const db = {
      transaction: vi.fn(async <R>(cb: (tx: FakeTx) => Promise<R>) => cb(tx)),
    };

    return { db, tx, executeCalls };
  }

  it('opens a transaction and creates the temp table', async () => {
    const { db, tx } = createFakeDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await withFgaFilterIds(db as any, ['id-1'], async () => 'ok');

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.execute).toHaveBeenCalled();
  });

  it('skips inserts when the ids array is empty but still creates the temp table', async () => {
    const { db, tx } = createFakeDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await withFgaFilterIds(db as any, [], async () => 'callback-result');

    expect(result).toBe('callback-result');
    // exactly one execute (the CREATE TEMP TABLE), no INSERT
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });

  it('chunks inserts when ids exceed the chunk size', async () => {
    const { db, tx } = createFakeDb();
    // Generate 12,000 ids, chunk size is 5000 → 1 create + 3 inserts = 4 execute calls
    const ids = Array.from({ length: 12_000 }, (_, i) => `id-${i}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await withFgaFilterIds(db as any, ids, async () => undefined);

    expect(tx.execute).toHaveBeenCalledTimes(1 + 3);
  });

  it('returns the callback result', async () => {
    const { db } = createFakeDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await withFgaFilterIds(db as any, ['id-1'], async () => ({ count: 42 }));

    expect(result).toEqual({ count: 42 });
  });
});

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
