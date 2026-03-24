import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { gradeEnum, schoolLevelEnum, freeReducedLunchStatusEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Run Demographics Table
 *
 * Stores a snapshot of user demographics at the time of an assessment run. This data is kept
 * separate from the assessment database because it contains PII (Personally Identifiable Information).
 *
 * Note: This table exists in the core database while run data is in the assessment database,
 * maintaining PII separation while allowing demographic analysis of assessment results.
 */
export const runDemographics = db.table('run_demographics', {
  id: p
    .uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  runId: p.uuid().notNull().unique(),

  statusEll: p.boolean(),
  statusFrl: freeReducedLunchStatusEnum(),
  statusIep: p.boolean(),

  gender: p.text(),
  race: p.text(),
  hispanicEthnicity: p.boolean(),
  homeLanguage: p.text(),

  ageInMonths: p.integer(),
  grade: gradeEnum(),
  schoolLevel: schoolLevelEnum().generatedAlwaysAs(sql`app.get_school_level_from_grade(grade)`),

  ...timestamps,
});

export type RunDemographics = typeof runDemographics.$inferSelect;
export type NewRunDemographics = typeof runDemographics.$inferInsert;
