/**
 * Integration tests for `withFgaFilterIds`.
 *
 * The unit test uses a fake DB to verify call structure (chunking, callback
 * shape, error propagation). These integration tests verify behavior the unit
 * test can't: that the temp table is created, populated, and dropped on
 * commit/rollback against a real Postgres connection.
 *
 * Without these, we'd be relying on Postgres's `ON COMMIT DROP` and session-scope
 * semantics being correctly invoked — but we'd never have proven they are.
 */
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { CoreDbClient } from '../../test-support/db';
import { withFgaFilterIds } from './fga-filter-ids.utils';

const SAMPLE_UUIDS = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
];

describe('withFgaFilterIds (integration)', () => {
  it('materializes ids into a temp table that the callback can read', async () => {
    const rows = await withFgaFilterIds(CoreDbClient, SAMPLE_UUIDS, async (tx) => {
      const result = await tx.execute<{ id: string }>(sql`SELECT id::text AS id FROM fga_filter_ids ORDER BY id`);
      return result.rows.map((r) => r.id);
    });

    expect(rows).toEqual(SAMPLE_UUIDS);
  });

  it('drops the temp table on commit so subsequent transactions see it gone', async () => {
    // Run once to create + commit + drop the table.
    await withFgaFilterIds(CoreDbClient, SAMPLE_UUIDS, async () => 'first-tx');

    // The temp table should not exist outside the transaction. Open a fresh
    // transaction and ask Postgres directly: if the table still existed, this
    // SELECT would succeed; instead it must error with the Postgres "undefined
    // table" error (SQLSTATE 42P01 — "relation X does not exist"). The Drizzle
    // pg adapter wraps the underlying pg error in a `DrizzleQueryError`, so
    // the SQLSTATE code and human-readable message live on `error.cause`.
    // Asserting on both pins the failure mode so a future implementation that
    // swapped `ON COMMIT DROP` for `ON COMMIT DELETE ROWS` (leaving the table
    // in place but empty) would fail this test.
    await expect(
      CoreDbClient.transaction(async (tx) => {
        return tx.execute(sql`SELECT 1 FROM fga_filter_ids LIMIT 1`);
      }),
    ).rejects.toMatchObject({
      cause: {
        message: expect.stringMatching(/relation .*fga_filter_ids.* does not exist/i),
        code: '42P01',
      },
    });
  });

  it('drops the temp table on rollback so subsequent transactions see it gone', async () => {
    // Force the callback to throw → transaction rolls back. The ON COMMIT DROP
    // semantics also drop the table on rollback, so the next transaction must
    // not see it.
    await expect(
      withFgaFilterIds(CoreDbClient, SAMPLE_UUIDS, async () => {
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');

    await expect(
      CoreDbClient.transaction(async (tx) => {
        return tx.execute(sql`SELECT 1 FROM fga_filter_ids LIMIT 1`);
      }),
    ).rejects.toMatchObject({
      cause: {
        message: expect.stringMatching(/relation .*fga_filter_ids.* does not exist/i),
        code: '42P01',
      },
    });
  });

  it("isolates concurrent transactions — one session does not see another session's temp table", async () => {
    // Two `withFgaFilterIds` calls running in parallel must each see only their
    // own ids. The temp table is session-scoped; pg pool checks out separate
    // connections so the two transactions don't share state.
    const idsA = ['aaaaaaaa-0001-0001-0001-000000000001'];
    const idsB = ['bbbbbbbb-0002-0002-0002-000000000002'];

    const [resultA, resultB] = await Promise.all([
      withFgaFilterIds(CoreDbClient, idsA, async (tx) => {
        const r = await tx.execute<{ id: string }>(sql`SELECT id::text AS id FROM fga_filter_ids ORDER BY id`);
        return r.rows.map((row) => row.id);
      }),
      withFgaFilterIds(CoreDbClient, idsB, async (tx) => {
        const r = await tx.execute<{ id: string }>(sql`SELECT id::text AS id FROM fga_filter_ids ORDER BY id`);
        return r.rows.map((row) => row.id);
      }),
    ]);

    expect(resultA).toEqual(idsA);
    expect(resultB).toEqual(idsB);
  });

  it('supports an INNER JOIN against fga_filter_ids — the canonical consumer pattern', async () => {
    // Synthetic 1-row VALUES set, joined against the temp table. This mimics
    // what production consumers will do (join real tables against fga_filter_ids
    // to filter by FGA-resolved IDs) without requiring a fixture row in the
    // schema-managed tables.
    const rows = await withFgaFilterIds(CoreDbClient, SAMPLE_UUIDS, async (tx) => {
      const result = await tx.execute<{ id: string }>(sql`
        SELECT v.id::text AS id
        FROM (VALUES
          (${SAMPLE_UUIDS[0]}::uuid),
          (${SAMPLE_UUIDS[1]}::uuid),
          ('99999999-9999-9999-9999-999999999999'::uuid)
        ) AS v(id)
        INNER JOIN fga_filter_ids fga ON fga.id = v.id
        ORDER BY v.id
      `);
      return result.rows.map((r) => r.id);
    });

    // The third VALUES row isn't in the temp table, so the JOIN excludes it.
    expect(rows).toEqual([SAMPLE_UUIDS[0], SAMPLE_UUIDS[1]]);
  });

  it('handles an empty ids array (temp table exists but has no rows)', async () => {
    const count = await withFgaFilterIds(CoreDbClient, [], async (tx) => {
      const result = await tx.execute<{ n: string }>(sql`SELECT COUNT(*)::text AS n FROM fga_filter_ids`);
      return Number(result.rows[0]!.n);
    });

    expect(count).toBe(0);
  });
});
