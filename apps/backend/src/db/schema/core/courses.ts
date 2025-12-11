import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { orgs } from './orgs';

const db = p.pgSchema('app');

/**
 * Courses Table
 *
 * Stores information about courses in the system. Courses can belong to any org type (e.g., district, school)
 * and serve as templates for classes. For example, a district might define a course "Reading 101", which is
 * then taught as individual classes: "Reading 101 - 2025-2026", "Reading 101 - 2026-2027", etc.
 *
 * @see {@link orgs} - The organization that owns this course
 * @see {@link classes} - Classes that reference this course
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
      .references(() => orgs.id, { onDelete: 'restrict' })
      .notNull(),

    name: p.text().notNull(),
    number: p.text().notNull(),

    ...timestamps,
  },
  (table) => [
    // Constraints
    // - Ensure unique course name per org (case-insensitive)
    p.uniqueIndex('courses_org_name_lower_uniqIdx').on(table.orgId, sql`lower(${table.name})`),
    // - Ensure unique course number per org
    p.uniqueIndex('courses_org_number_uniqIdx').on(table.orgId, table.number),

    // Indexes
    // - Name equality or prefix lookups
    p.index('courses_name_lower_idx').on(sql`lower(${table.name})`),
    p.index('courses_name_lower_pattern_idx').on(sql`lower(${table.name}) text_pattern_ops`),
  ],
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
