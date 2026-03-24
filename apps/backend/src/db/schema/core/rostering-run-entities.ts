import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { rosteringEntityTypeEnum, rosteringEntityStatusEnum } from '../enums';
import { rosteringRuns } from './rostering-runs';

const db = p.pgSchema('app');

/**
 * Rostering Run Entities Table
 *
 * Records the outcome of each entity processed during a rostering run. Each record
 * represents the final sync result for an entity (org, user, class, etc.) from an
 * external rostering provider.
 *
 * @see {@link rosteringRuns} - Parent run this entity was processed in
 */

export const rosteringRunEntities = db.table(
  'rostering_run_entities',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    rosteringRunId: p
      .uuid()
      .notNull()
      .references(() => rosteringRuns.id, { onDelete: 'cascade' }),

    entityType: rosteringEntityTypeEnum().notNull(),
    providerId: p.text().notNull(),

    status: rosteringEntityStatusEnum().notNull(),
    exceptions: p.text().array(),

    timestamp: p
      .timestamp({ withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    // Indexes
    // - Lookup by run
    p.index('rostering_run_entities_run_id_idx').on(table.rosteringRunId),

    // - Lookup entity history across runs
    p.index('rostering_run_entities_provider_id_idx').on(table.providerId),

    // - Find entities by status within a run
    p.index('rostering_run_entities_run_status_idx').on(table.rosteringRunId, table.status),
  ],
);

export type RosterRunEntity = typeof rosteringRunEntities.$inferSelect;
export type NewRosterRunEntity = typeof rosteringRunEntities.$inferInsert;
