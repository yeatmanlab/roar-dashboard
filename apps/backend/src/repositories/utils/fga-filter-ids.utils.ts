import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';

/**
 * Maximum number of UUIDs to insert per `INSERT ... VALUES (...)` statement.
 *
 * Postgres has a hard limit of ~65,535 parameters per query; chunking keeps each
 * insert well under that ceiling and avoids large query plans.
 */
const FGA_FILTER_INSERT_CHUNK_SIZE = 5000;

/**
 * Drizzle transaction handle, narrowed to the surface this helper needs.
 *
 * Why `unknown`/dynamic schema? Repositories may use either the core or assessment
 * Drizzle schemas, and `withFgaFilterIds` is schema-agnostic — it only issues raw
 * `sql` template literals and never accesses typed schema columns.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FgaFilterTx = PgTransaction<any, any, any>;

/**
 * Run `callback` inside a Drizzle transaction with the given UUIDs materialized
 * into a session-scoped temp table named `fga_filter_ids` so SQL can `INNER JOIN`
 * against them instead of `WHERE id IN (...)`.
 *
 * ## When to use this helper
 *
 * Prefer `inArray()` (and `BaseRepository.getByIds()`) for low-cardinality FGA
 * results — typically ≤ ~500 ids — where the planner handles `IN (...)` well.
 *
 * Switch to `withFgaFilterIds()` for high-cardinality FGA results (thousands of
 * ids), where:
 *   - The bind-parameter cost of `IN (...)` becomes significant.
 *   - The planner picks worse plans than it would for a temp-table JOIN.
 *
 * The administration / district / school domains are low-cardinality (a user
 * rarely has access to thousands of administrations). The user / class domains
 * will hit this scale as soon as they migrate to FGA — those repositories
 * should adopt `withFgaFilterIds()`.
 *
 * ## Behavior
 *
 * 1. Opens a transaction.
 * 2. Creates `TEMP TABLE fga_filter_ids (id uuid PRIMARY KEY) ON COMMIT DROP`.
 *    The table is local to the session and dropped automatically when the
 *    transaction commits or rolls back, so concurrent requests don't collide.
 * 3. Bulk-inserts `ids` in chunks of {@link FGA_FILTER_INSERT_CHUNK_SIZE} via
 *    parameterized `INSERT ... VALUES ($1), ($2), ...`.
 * 4. Invokes `callback(tx)` with the transaction handle. Compose your `INNER
 *    JOIN fga_filter_ids fga ON fga.id = <table>.id` inside `sql\`...\`` template
 *    literals or via Drizzle's `sql` helper.
 *
 * If `ids` is empty, the temp table is still created (so callbacks that reference
 * it don't fail) but no rows are inserted. The expectation is that the caller
 * short-circuits the empty case before invoking this helper, but the no-row
 * fallback keeps the helper robust.
 *
 * @param db - Drizzle database client (any schema)
 * @param ids - FGA-resolved UUIDs to materialize
 * @param callback - Invoked with the transaction handle so SQL inside it can
 *                   `INNER JOIN fga_filter_ids` to filter results
 * @returns The value returned by `callback`
 *
 * @example
 * ```typescript
 * const ids = await collectStreamedFgaIds(generator);
 * const items = await withFgaFilterIds(db, ids, async (tx) => {
 *   return tx.execute(sql`
 *     SELECT u.* FROM users u
 *     INNER JOIN fga_filter_ids fga ON fga.id = u.id
 *     WHERE u.rostering_ended IS NULL
 *     ORDER BY u.name_last
 *   `);
 * });
 * ```
 */
export async function withFgaFilterIds<R>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>,
  ids: readonly string[],
  callback: (tx: FgaFilterTx) => Promise<R>,
): Promise<R> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`CREATE TEMP TABLE fga_filter_ids (id uuid PRIMARY KEY) ON COMMIT DROP`);

    if (ids.length > 0) {
      for (let offset = 0; offset < ids.length; offset += FGA_FILTER_INSERT_CHUNK_SIZE) {
        const chunk = ids.slice(offset, offset + FGA_FILTER_INSERT_CHUNK_SIZE);
        // Build a single multi-row INSERT with parameterized placeholders
        const valuesSql = sql.join(
          chunk.map((id) => sql`(${id}::uuid)`),
          sql`, `,
        );
        await tx.execute(sql`INSERT INTO fga_filter_ids (id) VALUES ${valuesSql}`);
      }
    }

    return callback(tx as FgaFilterTx);
  });
}

/**
 * Collect an async generator of FGA streamed-list-objects responses into an
 * array of fully-qualified object strings.
 *
 * Production callers usually want this when they need a single materialized
 * list of object IDs. For very high-cardinality cases prefer iterating the
 * generator directly so you don't hold the whole list in memory.
 *
 * @param generator - Generator yielding `{ object: string }` chunks (the SDK's
 *                    `StreamedListObjectsResponse` shape)
 * @returns Promise resolving to an array of fully-qualified FGA object strings
 *          (e.g., `['administration:abc-123', 'administration:def-456']`)
 */
export async function collectStreamedFgaObjects(generator: AsyncIterable<{ object: string }>): Promise<string[]> {
  const objects: string[] = [];
  for await (const chunk of generator) {
    objects.push(chunk.object);
  }
  return objects;
}
