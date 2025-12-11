import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { runTrials } from './run-trials';
import { trialInteractionTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Run Trial Interactions Table
 *
 * Stores user interaction events during individual trials. These events capture engagement
 * signals like window focus/blur, mouse movements, or other UI interactions that may indicate
 * attention or distraction during the assessment.
 *
 * @see {@link runTrials} - Parent trial this interaction occurred during
 */

export const runTrialInteractions = db.table(
  'run_trial_interactions',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    trialId: p
      .uuid()
      .references(() => runTrials.id, { onDelete: 'cascade' })
      .notNull(),

    interactionType: trialInteractionTypeEnum().notNull(),
    timeMs: p.integer().notNull(),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Lookup interactions by trial
    p.index('run_trial_interactions_trial_id_idx').on(table.trialId),
  ],
);

export type RunTrialInteraction = typeof runTrialInteractions.$inferSelect;
export type NewRunTrialInteraction = typeof runTrialInteractions.$inferInsert;
