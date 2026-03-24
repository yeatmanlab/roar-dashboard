import { relations } from 'drizzle-orm';
import { runs } from './runs';
import { runTrials } from './run-trials';
import { runTrialInteractions } from './run-trial-interactions';
import { runScores } from './run-scores';

/**
 * Assessment Schema Relations
 *
 * Defines Drizzle ORM relations for the assessment database tables.
 * These enable the relational query API (e.g., `with: { trials: true }`).
 *
 * Hierarchy:
 * - runs (1) → (many) runTrials → (many) runTrialInteractions
 * - runs (1) → (many) runScores
 */

/**
 * Run Relations
 *
 * A run has many trials (individual stimulus-response records) and many scores
 * (computed assessment results).
 */
export const runsRelations = relations(runs, ({ many }) => ({
  trials: many(runTrials),
  scores: many(runScores),
}));

/**
 * Run Trials Relations
 *
 * A trial belongs to one run and can have many interactions (engagement events).
 */
export const runTrialsRelations = relations(runTrials, ({ one, many }) => ({
  run: one(runs, {
    fields: [runTrials.runId],
    references: [runs.id],
  }),
  interactions: many(runTrialInteractions),
}));

/**
 * Run Trial Interactions Relations
 *
 * An interaction belongs to one trial.
 */
export const runTrialInteractionsRelations = relations(runTrialInteractions, ({ one }) => ({
  runTrial: one(runTrials, {
    fields: [runTrialInteractions.trialId],
    references: [runTrials.id],
  }),
}));

/**
 * Run Scores Relations
 *
 * A score belongs to one run.
 */
export const runScoresRelations = relations(runScores, ({ one }) => ({
  run: one(runs, {
    fields: [runScores.runId],
    references: [runs.id],
  }),
}));
