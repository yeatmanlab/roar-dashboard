import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { ltree, timestamps } from '../common';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { courses } from './courses';
import { classTypeEnum, gradeEnum, schoolLevelEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * Classes Table
 *
 * Stores information about classes in the system. Classes belong to schools (referenced via `schoolId`)
 * and optionally reference a course template. For example, School X offers a course called "Reading 101",
 * taught on a yearly basis with classes "Reading 101 - 2025-2026", "Reading 101 - 2026-2027", etc.
 *
 * @see {@link orgs} - Referenced via schoolId and districtId
 * @see {@link courses} - Optional course template this class is based on
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
      .references((): AnyPgColumn => orgs.id, { onDelete: 'restrict' })
      .notNull(),
    districtId: p
      .uuid()
      .references((): AnyPgColumn => orgs.id, { onDelete: 'restrict' })
      .notNull(),
    courseId: p.uuid().references((): AnyPgColumn => courses.id, { onDelete: 'restrict' }),

    /**
     * Materialized path copied from the parent school's org path.
     * Used for hierarchical authorization queries via ltree operators.
     * Maintained via database triggers on insert/update.
     */
    orgPath: ltree('org_path').notNull(),

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
    // - Foreign key lookups
    p.index('classes_district_idx').on(table.districtId),
    p.index('classes_course_idx').on(table.courseId),
    p.index('classes_org_path_gist_idx').using('gist', table.orgPath),

    // - Name equality or prefix lookups
    p.index('classes_name_lower_idx').on(sql`lower(${table.name})`),
    p.index('classes_name_lower_pattern_idx').on(sql`lower(${table.name}) text_pattern_ops`),
  ],
);

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
