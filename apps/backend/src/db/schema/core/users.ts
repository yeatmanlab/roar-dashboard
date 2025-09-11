import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { authProviderEnum, gradeEnum, schoolLevelEnum, freeReducedLunchStatusEnum, userTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Users Table
 *
 * Stores information about users in the system.
 *
 * - `assessmentPid`: The assessmentPid is a unique identifier for the user in the system. It is generated automatically
 *   during the rostering process and usually includes the district and school prefixes.
 *
 * - `authId`: The authId should ideally be not nullable, but currently has to be nullable due to the way the rostering
 *   process currently handles user syncing and auth record creation.
 */

export const users = db.table(
  'users',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    assessmentPid: p.text().notNull().unique(),
    authProvider: authProviderEnum()
      .array()
      .default(sql`'{}'::"app"."auth_provider"[]`),
    authId: p.text().unique(),

    username: p.text().unique(),
    email: p.text(),
    userType: userTypeEnum(),

    dob: p.date(),
    grade: gradeEnum(),
    schoolLevel: schoolLevelEnum().generatedAlwaysAs(sql`app.get_school_level_from_grade(grade)`),

    statusEll: p.boolean(),
    statusFrl: freeReducedLunchStatusEnum(),
    statusIep: p.boolean(),

    studentId: p.text(),
    sisId: p.text(),
    stateId: p.text(),
    localId: p.text(),

    gender: p.text(),
    race: p.text(),
    hispanicEthnicity: p.boolean(),
    homeLanguage: p.text(),

    excludeFromResearch: p.boolean().notNull().default(false),

    ...timestamps,
  },
  (table) => [
    // Ensure case-insensitive email uniqueness
    p
      .uniqueIndex('users_email_lower_uniqIdx')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} IS NOT NULL`),

    // Ensure DOB is in the past
    p.check('users_dob_in_past', sql`${table.dob} IS NULL OR ${table.dob} <= now()::date`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
