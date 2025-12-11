import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { runs } from './runs';
import { assessmentStageEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Run Trials Table
 *
 * Stores individual trial records within an assessment run. Each trial represents a single
 * stimulus-response interaction (e.g., one word shown, one answer given). Trials capture
 * the raw assessment data needed for scoring and research analysis.
 *
 * Note: Most fields are nullable because different assessment types record different data.
 * The schema is intentionally flexible to accommodate various ROAR assessment formats with
 * the goal to standardize the data storage format in the near future.
 *
 * @see {@link runs} - Parent run this trial belongs to (cascade delete)
 * @see {@link runTrialInteractions} - User interactions during this trial
 */

export const runTrials = db.table(
  'run_trials',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    runId: p
      .uuid()
      .references(() => runs.id, { onDelete: 'cascade' })
      .notNull(),

    assessmentStage: assessmentStageEnum(),
    audioFeedback: p.text(),
    block: p.text(),
    blockId: p.text(),
    buttonResponse: p.integer(),
    corpusId: p.text(),
    correct: p.integer(),
    correctResponse: p.text(),
    difficulty: p.text(),
    goal: p.text(),
    internalNodeId: p.text(),
    item: p.text(),
    itemId: p.text(),
    keyboardResponse: p.text(),
    realpseudo: p.text(),
    response: p.text(),
    responseInput: p.text(),
    responseSource: p.text(),
    responseTimeMs: p.integer(),
    startTime: p.text(),
    startTimeUnix: p.integer(),
    stim: p.text(),
    stimulus: p.text(),
    stimulusRule: p.text(),
    story: p.boolean(),
    subtask: p.text(),
    thetaEstimate: p.doublePrecision(),
    thetaEstimate2: p.doublePrecision(),
    thetaStdErr: p.doublePrecision(),
    thetaStdErr2: p.doublePrecision(),
    thetas: p.jsonb(),
    thetaStdErrs: p.jsonb(),
    itemParameters: p.jsonb(),
    timeElapsed: p.integer(),
    timezone: p.text(),
    trialNumBlock: p.integer(),
    trialNumTotal: p.integer(),
    trialIndex: p.integer(),
    trialType: p.text(),
    truefalse: p.text(),
    word: p.text(),
    metadata: p.jsonb(),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Lookup for all trials for a specific run
    p.index('run_trials_run_id_idx').on(table.runId),

    // - Lookup trials for a run in order
    p.index('run_trials_run_trial_idx').on(table.runId, table.trialIndex),
  ],
);

export type RunTrial = typeof runTrials.$inferSelect;
export type NewRunTrial = typeof runTrials.$inferInsert;
