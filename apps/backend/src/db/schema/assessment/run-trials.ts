import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { runs } from './runs';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { assessmentStageEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Runs Trials Table
 *
 * Stores information about run trials in the system. For every run, multiple trials are recorded throughout the
 * assessment. These trials are stored in the assessment database without any PII for research purposes.
 */

export const runTrials = db.table('run_trials', {
  id: p
    .uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  runId: p
    .uuid()
    .references((): AnyPgColumn => runs.id)
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
});

export type RunTrial = typeof runTrials.$inferSelect;
export type NewRunTrial = typeof runTrials.$inferInsert;
