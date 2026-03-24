/**
 * core.app_assessment_fdw.runs
 *
 * This is a postgres_fdw foreign table that maps directly to the assessment DB's
 * `app.runs` table. Soft-delete filtering (deleted_at IS NULL) must be applied
 * in the core DB query layer.
 *
 * Data flow: core DB (app_assessment_fdw.runs) → assessment DB (app.runs)
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
 * import { eq, isNull } from 'drizzle-orm';
 *
 * // Always use getCoreDbClient() — the foreign tables live in the core database
 * // Always filter out soft-deleted runs
 * const runs = await getCoreDbClient()
 *   .select()
 *   .from(fdwRuns)
 *   .where(and(eq(fdwRuns.administrationId, adminId), isNull(fdwRuns.deletedAt)));
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
  metadata: p.jsonb(),
  isAnonymous: p.boolean().notNull(),
  completedAt: p.timestamp({ withTimezone: true }),
  abortedAt: p.timestamp({ withTimezone: true }),
  deletedAt: p.timestamp({ withTimezone: true }),
  deletedBy: p.uuid(),
  updatedAt: p.timestamp({ withTimezone: true }),
  createdAt: p.timestamp({ withTimezone: true }).notNull(),
});

export type FdwRun = typeof fdwRuns.$inferSelect;
