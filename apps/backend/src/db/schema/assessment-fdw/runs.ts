/**
 * core.app_assessment_fdw.runs
 *
 * This is a postgres_fdw foreign table that maps to the assessment DB's
 * `app_fdw.fdw_runs` view. The view filters out soft-deleted runs and exposes
 * only the columns needed for cross-database joins and queries.
 *
 * Data flow: core DB (app_assessment_fdw.runs) → assessment DB (app_fdw.fdw_runs view) → assessment DB (app.runs)
 *
 * This directory is intentionally excluded from drizzle.config.ts schema discovery.
 * Foreign tables are managed by SQL migrations, not Drizzle's push/generate.
 * These tables are not registered in CoreDbSchema, so the relational query API
 * (CoreDbClient.query.*) is not available — use the SQL-style API instead.
 *
 * @example
 * ```typescript
 * import { fdwRuns } from '@/db/schema/assessment-fdw/runs';
 * import { getCoreDbClient } from '@/db/clients';
 * import { eq } from 'drizzle-orm';
 *
 * // Always use getCoreDbClient() — the foreign tables live in the core database
 * const runs = await getCoreDbClient()
 *   .select()
 *   .from(fdwRuns)
 *   .where(eq(fdwRuns.administrationId, adminId));
 * ```
 */
import * as p from 'drizzle-orm/pg-core';

const db = p.pgSchema('app_assessment_fdw');

export const fdwRuns = db.table('runs', {
  id: p.uuid().notNull(),
  userId: p.uuid().notNull(),
  taskId: p.uuid().notNull(),
  taskVariantId: p.uuid().notNull(),
  taskVersion: p.text().notNull(),
  administrationId: p.uuid().notNull(),
  useForReporting: p.boolean().notNull(),
  reliableRun: p.boolean().notNull(),
  engagementFlags: p.jsonb(),
  isAnonymous: p.boolean(),
  completedAt: p.timestamp({ withTimezone: true }),
  abortedAt: p.timestamp({ withTimezone: true }),
  createdAt: p.timestamp({ withTimezone: true }).notNull(),
});

export type FdwRun = typeof fdwRuns.$inferSelect;
