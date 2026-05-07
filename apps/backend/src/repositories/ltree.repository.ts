import type { AnyColumn } from 'drizzle-orm';
import { eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTable } from 'drizzle-orm/pg-core';
import { alias } from 'drizzle-orm/pg-core';
import { BaseRepository } from './base.repository';

/**
 * Abstract repository for tables that store hierarchical data using PostgreSQL ltree.
 *
 * Extends `BaseRepository` with operations that need a materialized path column
 * (`ltree`). Repositories that do not store a path (`UserRepository`,
 * `RunRepository`, etc.) should continue to extend `BaseRepository` directly —
 * `LtreeRepository` is opt-in for repositories whose driving table participates
 * in an ltree hierarchy.
 *
 * Subclasses configure two things via the constructor:
 *
 * 1. **`pathColumn`** — the ltree column on the driving table. The column name
 *    differs across the codebase (`orgs.path`, `classes.orgPath`), so the
 *    column reference is passed explicitly rather than inferred via a
 *    structural type constraint.
 * 2. **`ancestorTable`** (optional) — the table where root rows live. Defaults
 *    to the driving table itself, which is the right choice when nodes and
 *    their roots share a table (e.g., `orgs` rooted in `orgs`). Pass a
 *    different table when ancestors live elsewhere — for example, classes
 *    are rooted in `orgs`, so `ClassRepository` passes `(classes, classes.orgPath, orgs, orgs.path)`.
 *
 * Method naming follows the existing repository convention:
 * `getDistinctRootOrgIds` is intentionally specific — in this codebase the top
 * of every ltree path is an org row (district, state, national, etc.), so the
 * return type is always `{ id: string }[]` against `app.orgs`.
 *
 * @typeParam TEntity - The select type of the driving entity (from `$inferSelect`).
 * @typeParam TTable - The Drizzle PgTable reference for the driving entity.
 *
 * @example
 * ```typescript
 * // Districts and schools — driving rows live in orgs, ancestors live in orgs.
 * export class DistrictRepository extends LtreeRepository<District, typeof orgs> {
 *   constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
 *     super(db, orgs, orgs.path);
 *   }
 * }
 *
 * // Classes — driving rows live in classes, ancestors live in orgs.
 * export class ClassRepository extends LtreeRepository<Class, typeof classes> {
 *   constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
 *     super(db, classes, classes.orgPath, orgs, orgs.path);
 *   }
 * }
 * ```
 */
export abstract class LtreeRepository<
  TEntity extends Record<string, unknown>,
  TTable extends PgTable,
> extends BaseRepository<TEntity, TTable> {
  /**
   * The ltree column on the driving table (`this.table`).
   */
  protected readonly pathColumn: AnyColumn;

  /**
   * The table where root rows are resolved. Defaults to `this.table` when
   * roots and descendants share a table (e.g., `orgs` rooted in `orgs`).
   */
  protected readonly ancestorTable: PgTable;

  /**
   * The id column of `ancestorTable`. Resolved from the table reference so
   * subclasses don't need to pass it explicitly.
   */
  protected readonly ancestorIdColumn: AnyColumn;

  /**
   * The ltree column on `ancestorTable` used as the join target.
   */
  protected readonly ancestorPathColumn: AnyColumn;

  /**
   * @param db - Drizzle database client.
   * @param table - The Drizzle table reference for this repository.
   * @param pathColumn - The ltree column on `table`.
   * @param ancestorTable - Optional separate table where root rows live.
   *                       Defaults to `table` for self-rooted hierarchies.
   * @param ancestorPathColumn - Optional ltree column on `ancestorTable`.
   *                             Defaults to `pathColumn` when `ancestorTable`
   *                             is the same as `table`. Required when
   *                             `ancestorTable` differs from `table`.
   */
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: NodePgDatabase<any>,
    table: TTable,
    pathColumn: AnyColumn,
    ancestorTable?: PgTable,
    ancestorPathColumn?: AnyColumn,
  ) {
    super(db, table);
    this.pathColumn = pathColumn;
    this.ancestorTable = ancestorTable ?? table;

    // Mirror BaseRepository's runtime column-access pattern. `id` is required
    // on every table per the codebase convention; `ancestorPathColumn` falls
    // back to the driving path column only when the ancestor and driving
    // tables are the same.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ancestorTyped = this.ancestorTable as PgTable & Record<string, any>;
    this.ancestorIdColumn = ancestorTyped['id'] as AnyColumn;
    this.ancestorPathColumn = ancestorPathColumn ?? pathColumn;
  }

  /**
   * Returns the distinct set of root org ids covering a list of node ids.
   *
   * For each input id, the node's "root" is the row in `ancestorTable` whose
   * path is the first label of the node's path — i.e., `subpath(path, 0, 1)`
   * extracts the top-level label, and the join resolves it back to a real
   * row.
   *
   * The variation across subclasses is just two table references — the driving
   * table (rows being looked up) and the ancestor table (where the roots
   * live). For districts and schools, both are `orgs`. For classes, the
   * driving table is `classes` and the ancestor table is `orgs` because a
   * class's `org_path` is composed of org labels.
   *
   * Notes:
   * - Roots are returned without the input→root mapping. If you need to know
   *   which input maps to which root, add a non-distinct variant — this
   *   abstraction does not provide one.
   * - Orphan paths — root labels that have no matching row in `ancestorTable`
   *   — are silently dropped by the inner join. This shouldn't occur in
   *   practice (the path-computation triggers maintain referential integrity),
   *   but if you need orphans surfaced, write a custom query that uses a
   *   left join instead.
   * - An empty `ids` array short-circuits to `[]` without round-tripping to
   *   the database.
   * - Duplicate input ids do not produce duplicate roots — `selectDistinct`
   *   guarantees each root appears at most once.
   * - The roots returned are always rows from `ancestorTable`. In this
   *   codebase that is always `orgs`, so callers should treat the returned
   *   ids as `orgs.id` values, regardless of whether the top-level org is a
   *   district, state, national, or local.
   *
   * @param ids - The ids of the nodes whose roots should be resolved.
   * @returns The distinct set of root rows, each with an `id` field.
   */
  async getDistinctRootOrgIds(ids: string[]): Promise<{ id: string }[]> {
    // Short-circuit: `inArray` with an empty array generates `false` and
    // would round-trip to the database for a guaranteed-empty result.
    if (ids.length === 0) return [];

    // Self-join alias: when `ancestorTable === this.table` (e.g., orgs joined
    // to orgs), the root and node references would collapse to the same
    // table identifier. The alias gives the join target a distinct name so
    // the ON clause is unambiguous.
    const root = alias(this.ancestorTable, 'root');

    // Drizzle's strict generics can't resolve dynamically-named columns
    // through a generic `TTable` parameter; mirror `BaseRepository`'s
    // dynamic-access pattern by reading column references off a typed
    // intersection view of the table. The casts are scoped to query
    // construction and do not leak into the public surface.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drivingTable = this.table as PgTable & Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootTable = root as PgTable & Record<string, any>;
    const idColumn = drivingTable['id'] as Parameters<typeof eq>[0];
    const rootIdColumn = rootTable['id'] as AnyColumn;
    const rootPathColumn = rootTable[this.ancestorPathColumnName()] as AnyColumn;

    // `subpath(path, 0, 1)` extracts the first label of the ltree — that is,
    // the root label of the node's tree. We then look up the ancestor row
    // whose own path equals that single-label ltree, which is the root row.
    const result = await this.db
      .selectDistinct({ id: sql<string>`${rootIdColumn}` })
      .from(drivingTable)
      .innerJoin(rootTable, sql`${rootPathColumn} = subpath(${this.pathColumn}, 0, 1)`)
      .where(inArray(idColumn, ids));

    return result;
  }

  /**
   * Returns the JS property name for the ancestor path column.
   *
   * Drizzle's `alias()` returns a proxy whose columns are accessible by the
   * same property keys as the original table. For the ltree columns in this
   * codebase, the underlying SQL column name and the JS property name
   * happen to align (`orgs.path` is property `path` mapped to SQL `path`).
   * If a future ancestor table has a column where these differ (e.g.,
   * `classes.orgPath` is property `orgPath` mapped to SQL `org_path`),
   * subclasses must pass the correct property name explicitly via a
   * different mechanism rather than relying on the SQL name.
   */
  private ancestorPathColumnName(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const column = this.ancestorPathColumn as any;
    return column.name as string;
  }
}
