import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';

const db = p.pgSchema('app');

/**
 * Courses Table
 *
 * Stores information about courses in the system. By internal definition, courses are only available in schools
 * (orgType = school) and optionally reference a course. For example, School X offers a course called "Reading 101",
 * taught on a yearly basis with classes "Reading 101 - 2025-2026", "Reading 101 - 2026-2027", etc.
 */
export const courses = db.table(
  'courses',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    orgId: p
      .uuid()
      .references((): AnyPgColumn => orgs.id)
      .notNull(),

    name: p.text().notNull(),
    number: p.text().notNull(),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Ensure unique course name per org (case-insensitive)
    p.uniqueIndex('courses_org_name_lower_uniqIdx').on(table.orgId, sql`lower(${table.name})`),

    // Indexes
    // - Name equality or prefix lookups
    p.index('courses_name_lower_idx').on(sql`lower(${table.name})`),
  ],
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
