/**
 * core.app_assessment_fdw.run_scores
 *
 * This is a postgres_fdw foreign table that maps to the assessment DB's
 * `app_fdw.fdw_run_scores` view. The view joins through app.runs to filter
 * out scores belonging to soft-deleted runs.
 *
 * Data flow: core DB (app_assessment_fdw.run_scores) → assessment DB (app_fdw.fdw_run_scores view) → assessment DB (app.run_scores)
 *
 * Enums (score_type, assessment_stage) are mapped as text in PostgreSQL since
 * enums are database-local and cannot cross a FDW boundary. The TypeScript
 * types are narrowed via $type<>() using the source enum definitions.
 *
 * Query with getCoreDbClient() — see runs.ts for full usage example.
 */
import * as p from 'drizzle-orm/pg-core';
import { scoreTypeEnum, assessmentStageEnum } from '../enums';

type ScoreType = (typeof scoreTypeEnum.enumValues)[number];
type AssessmentStage = (typeof assessmentStageEnum.enumValues)[number];

const db = p.pgSchema('app_assessment_fdw');

export const fdwRunScores = db.table('run_scores', {
  id: p.uuid().notNull(),
  runId: p.uuid().notNull(),
  type: p.text().notNull().$type<ScoreType>(),
  domain: p.text().notNull(),
  name: p.text().notNull(),
  value: p.text().notNull(),
  assessmentStage: p.text().$type<AssessmentStage>(),
  categoryScore: p.boolean(),
});

export type FdwRunScore = typeof fdwRunScores.$inferSelect;
