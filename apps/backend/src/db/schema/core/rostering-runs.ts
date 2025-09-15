import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { rosteringProviderEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Rostering Runs Table
 *
 * Stores information about the automated rostering runs. For each rostering run, a single record is created in this
 * table. Additionally, the `rostering_run_entities` table is updated to reflect the entities that were rostered in
 * the current run.
 */

export const rosteringRuns = db.table('rostering_runs', {
  id: p
    .uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  rosteringProvider: rosteringProviderEnum().notNull(),
  syncStarted: p
    .timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  syncEnded: p.timestamp({ withTimezone: true }),
});

export type RosterRun = typeof rosteringRuns.$inferSelect;
export type NewRosterRun = typeof rosteringRuns.$inferInsert;
