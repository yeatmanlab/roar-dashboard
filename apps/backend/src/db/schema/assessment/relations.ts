import { relations } from 'drizzle-orm';
import { runs } from './runs';
import { runTrials } from './run-trials';
import { runTrialInteractions } from './run-trial-interactions';
import { runScores } from './run-scores';

/**
 * Run Relations
 */
export const runsRelations = relations(runs, ({ many }) => ({
  trials: many(runTrials),
}));

export const runTrialsRelations = relations(runTrials, ({ one }) => ({
  run: one(runs, {
    fields: [runTrials.runId],
    references: [runs.id],
  }),
}));

export const runTrialInteractionsRelations = relations(runTrialInteractions, ({ one }) => ({
  runTrial: one(runTrials, {
    fields: [runTrialInteractions.trialId],
    references: [runTrials.id],
  }),
}));

/**
 * Run Scores Relations
 */
export const runScoresRelations = relations(runScores, ({ one }) => ({
  run: one(runs, {
    fields: [runScores.runId],
    references: [runs.id],
  }),
}));
