import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { TablesRelationalConfig } from 'drizzle-orm/relations';

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
 * `sql` template literals and never accesses typed schema columns. The
 * `NodePgQueryResultHKT` is preserved (rather than `any`) so that
 * `tx.execute<TRow>(...)` returns `Promise<QueryResult<TRow>>` and callers get
 * properly-typed `result.rows[]`.
 */
export type FgaFilterTx = PgTransaction<
  NodePgQueryResultHKT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<string, any>,
  TablesRelationalConfig
>;

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
 * rarely has access to thousands of administrations). The class domain will
 * hit this scale as soon as `AdministrationService.getAdministrationTree`'s
 * class branch migrates to FGA-driven listing — that repository should adopt
 * `withFgaFilterIds()`. The user domain is intentionally untouched: the FGA
 * model has no `type user` relations, so there are no
 * `listAccessibleObjects(..., FgaType.USER)` calls to migrate.
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
 * it don't fail) but no rows are inserted. **Callers should short-circuit the
 * empty case before invoking this helper** — otherwise you pay for a
 * transaction + DDL round-trip just to materialize a guaranteed-empty JOIN
 * result. The no-row fallback exists to keep the helper robust against rare
 * race conditions; it is not an optimized path.
 *
 * @param db - Drizzle database client (any schema)
 * @param ids - FGA-resolved UUIDs to materialize. **Must be distinct** — the
 *              temp table declares `id uuid PRIMARY KEY`, so duplicate UUIDs
 *              will fail the INSERT with a Postgres `23505` (unique-violation)
 *              error. FGA's `streamedListObjects` returns distinct objects
 *              (it's a set operation), so this is normally satisfied by
 *              construction. If you merge results from multiple FGA calls or
 *              concatenate generator runs, de-dupe via `new Set(ids)` first.
 * @param callback - Invoked with the transaction handle so SQL inside it can
 *                   `INNER JOIN fga_filter_ids` to filter results
 * @returns The value returned by `callback`
 *
 * @example
 * ```typescript
 * // Collect a high-cardinality FGA stream into an array first (use
 * // `collectStreamedFgaObjects` from `services/authorization/helpers/`),
 * // then feed it into the temp-table join.
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
