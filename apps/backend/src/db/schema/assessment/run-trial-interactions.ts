import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { runTrials } from './run-trials';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { trialInteractionTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Runs Trial Interactions Table
 *
 * Stores information about run trial interactions in the system. For every run trial, assessments can record
 * user interactions (focus, blur, etc). These interactions are stored in the assessment database without any PII for
 * research purposes.
 */

export const runTrialInteractions = db.table('run_trial_interactions', {
  id: p
    .uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  trialId: p
    .uuid()
    .references((): AnyPgColumn => runTrials.id)
    .notNull(),

  interactionType: trialInteractionTypeEnum().notNull(),
  timeMs: p.integer().notNull(),

  ...timestamps,
});

export type RunTrialInteraction = typeof runTrialInteractions.$inferSelect;
export type NewRunTrialInteraction = typeof runTrialInteractions.$inferInsert;
