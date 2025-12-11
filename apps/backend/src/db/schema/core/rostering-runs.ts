import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { rosteringProviderEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Rostering Runs Table
 *
 * Tracks automated rostering synchronization runs. Each record represents a single
 * sync operation from an external rostering provider (e.g., Clever, ClassLink).
 *
 * @see {@link rosteringRunEntities} - Entities processed in each run
 */
export const rosteringRuns = db.table(
  'rostering_runs',
  {
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
  },
  (table) => [
    // Indexes
    // - Lookup runs by provider
    p.index('rostering_runs_provider_idx').on(table.rosteringProvider),

    // - Lookup running rostering runs by provider
    p
      .index('rostering_runs_provider_running_idx')
      .on(table.rosteringProvider)
      .where(sql`${table.syncEnded} IS NULL`),
  ],
);

export type RosterRun = typeof rosteringRuns.$inferSelect;
export type NewRosterRun = typeof rosteringRuns.$inferInsert;
