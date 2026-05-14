import { describe, expect, it, vi } from 'vitest';
import { withFgaFilterIds } from './fga-filter-ids.utils';

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

  // Boundary tests: exact chunk-size, one-over, and one-under. Off-by-one errors
  // around the chunking loop would silently double-insert or drop rows, so these
  // are explicit even if they look redundant.
  it.each([
    { length: 4_999, expectedInserts: 1 },
    { length: 5_000, expectedInserts: 1 },
    { length: 5_001, expectedInserts: 2 },
    { length: 10_000, expectedInserts: 2 },
    { length: 10_001, expectedInserts: 3 },
  ])('chunks correctly at boundary: $length ids → $expectedInserts INSERT(s)', async ({ length, expectedInserts }) => {
    const { db, tx } = createFakeDb();
    const ids = Array.from({ length }, (_, i) => `id-${i}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await withFgaFilterIds(db as any, ids, async () => undefined);

    // 1 CREATE TEMP TABLE + N INSERTs
    expect(tx.execute).toHaveBeenCalledTimes(1 + expectedInserts);
  });

  it('returns the callback result', async () => {
    const { db } = createFakeDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await withFgaFilterIds(db as any, ['id-1'], async () => ({ count: 42 }));

    expect(result).toEqual({ count: 42 });
  });

  it('propagates errors from the callback so the transaction rolls back', async () => {
    const { db } = createFakeDb();
    const callbackError = new Error('callback exploded');

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withFgaFilterIds(db as any, ['id-1'], async () => {
        throw callbackError;
      }),
    ).rejects.toThrow('callback exploded');

    // The transaction was opened — rollback is the responsibility of Drizzle's
    // transaction wrapper, but we verify here that the error is not swallowed.
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('does not catch DB errors during temp-table creation', async () => {
    // If the CREATE TEMP TABLE fails (e.g., permissions, connection drop),
    // the error must propagate so the caller can wrap it appropriately
    // — the helper does not silently swallow infrastructure failures.
    const ddlError = new Error('cannot create temp table');
    const tx: FakeTx = {
      execute: vi.fn(async () => {
        throw ddlError;
      }),
    };
    const db = {
      transaction: vi.fn(async <R>(cb: (tx: FakeTx) => Promise<R>) => cb(tx)),
    };

    let callbackInvoked = false;
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withFgaFilterIds(db as any, ['id-1'], async () => {
        callbackInvoked = true;
        return 'unreachable';
      }),
    ).rejects.toThrow('cannot create temp table');

    expect(callbackInvoked).toBe(false);
  });
});
