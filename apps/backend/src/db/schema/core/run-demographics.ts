import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { gradeEnum, schoolLevelEnum, freeReducedLunchStatusEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Run Demographics Table
 *
 * Stores demographics data of a given user, snapshotted at the time of a run. Whilst all the run data is stored in the
 * assessment database, the run demographics are stored in the core database as the contained data is considered PII.
 */
export const runDemographics = db.table('run_demographics', {
  runId: p.uuid().primaryKey(),

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
