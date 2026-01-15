import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { authProviderEnum, gradeEnum, schoolLevelEnum, freeReducedLunchStatusEnum, userTypeEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Users Table
 *
 * Stores information about users in the system. Users can be students, teachers, administrators,
 * parents, or other roles defined by `userType`.
 *
 * Key fields:
 * - `assessmentPid` - Unique identifier generated during rostering, typically includes district/school prefixes
 * - `authId` - External authentication provider ID (nullable due to rostering sync timing)
 * - `authProvider` - Array of authentication providers the user can use (e.g., Clever, ClassLink, Google)
 * - `schoolLevel` - Auto-generated from `grade` using `app.get_school_level_from_grade()`
 * - `excludeFromResearch` - When true, user's data should not be included in research datasets
 *
 * Status fields (ELL, FRL, IEP):
 * - `statusEll` - English Language Learner status
 * - `statusFrl` - Free/Reduced Lunch status
 * - `statusIep` - Individualized Education Program status
 *
 * Constraints:
 * - `email` must be unique (case-insensitive) when not null
 * - `dob` must be in the past when not null
 *
 * @see {@link userOrgs} - User's organization memberships
 * @see {@link userClasses} - User's class enrollments
 * @see {@link userFamilies} - User's family memberships
 * @see {@link userGroups} - User's group memberships
 *
 * @todo Should `authProvider` be notNull()?
 * @todo Should `authId` be notNull()?
 */
export const users = db.table(
  'users',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    assessmentPid: p.text().notNull().unique(),
    authProvider: authProviderEnum().array(),
    authId: p.text().unique(),

    nameFirst: p.text(),
    nameMiddle: p.text(),
    nameLast: p.text(),

    username: p.text().unique(),
    email: p.text().unique(),
    userType: userTypeEnum().notNull(),

    dob: p.date(),
    grade: gradeEnum(),
    schoolLevel: schoolLevelEnum().generatedAlwaysAs(sql`app.get_school_level_from_grade(grade)`),

    statusEll: p.text(),
    statusFrl: freeReducedLunchStatusEnum(),
    statusIep: p.text(),

    studentId: p.text(),
    sisId: p.text(),
    stateId: p.text(),
    localId: p.text(),

    gender: p.text(),
    race: p.text(),
    hispanicEthnicity: p.boolean(),
    homeLanguage: p.text(),

    excludeFromResearch: p.boolean().notNull().default(false),

    isSuperAdmin: p.boolean().notNull().default(false),

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
