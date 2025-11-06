import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { rosteringEntityTypeEnum, rosteringEntityStatusEnum } from '../enums';
import { rosteringRuns } from './rostering-runs';

const db = p.pgSchema('app');

/**
 * Rostering Run Entities Table
 *
 * Stores information about the entities that were rostered in any given run. During the automated rostering run,
 * this table is updated to reflect the entities that were rostered in the current run.
 */

export const rosteringRunEntities = db.table('rostering_run_entities', {
  rosteringRunId: p
    .uuid()
    .notNull()
    .references((): p.AnyPgColumn => rosteringRuns.id),
  entityType: rosteringEntityTypeEnum().notNull(),
  providerId: p.text().notNull(),
  status: rosteringEntityStatusEnum().notNull(),
  timestamp: p
    .timestamp({ withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type RosterRunEntity = typeof rosteringRunEntities.$inferSelect;
export type NewRosterRunEntity = typeof rosteringRunEntities.$inferInsert;
