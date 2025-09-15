import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { courses } from './courses';
import { classTypeEnum, gradeEnum, schoolLevelEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Classes Table
 *
 * Stores information about classes in the system. By internal definition, classes are only available in schools
 * (orgType = school) and optionally reference a course. For example, School X offers a course called "Reading 101",
 * taught on a yearly basis with classes "Reading 101 - 2025-2026", "Reading 101 - 2026-2027", etc.
 */
export const classes = db.table(
  'classes',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    name: p.text().notNull(),

    schoolId: p
      .uuid()
      .references((): AnyPgColumn => orgs.id)
      .notNull(),
    districtId: p
      .uuid()
      .references((): AnyPgColumn => orgs.id)
      .notNull(),
    courseId: p.uuid().references((): AnyPgColumn => courses.id),

    classType: classTypeEnum().notNull(),

    number: p.text(),
    period: p.text(),
    termId: p.uuid(),
    subjects: p.text().array(),
    location: p.text(),

    grades: gradeEnum().array(),
    schoolLevels: schoolLevelEnum()
      .array()
      .generatedAlwaysAs(sql`app.get_school_levels_from_grades_array(grades)`),

    rosteringEnded: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Ensure unique class name per school (case-insensitive)
    p.uniqueIndex('classes_school_name_lower_uniqIdx').on(table.schoolId, sql`lower(${table.name})`),

    // Indexes
    // - Name equality or prefix lookups
    p.index('classes_name_lower_idx').on(sql`lower(${table.name})`),
  ],
);

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
