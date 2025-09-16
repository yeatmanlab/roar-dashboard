import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';

const db = p.pgSchema('app');

/**
 * Tasks Table
 *
 * Stores information about tasks in the system. Each task is an assessment available within the ROAR platform.
 */

export const tasks = db.table(
  'tasks',
  {
    id: p
      .uuid()
      .default(sql`gen_random_uuid()`)
      .primaryKey(),

    slug: p.varchar({ length: 32 }).notNull(),

    name: p.text().notNull(),
    nameSimple: p.text().notNull(),
    nameTechnical: p.text().notNull(),

    description: p.text(),
    image: p.text(),
    tutorialVideo: p.text(),

    taskConfig: p.jsonb().notNull(),

    ...timestamps,
  },
  (table) => [
    // Indexes
    // - Slug lookups
    p.index('tasks_slug_lower_idx').on(sql`lower(${table.slug})`),
    // - Name lookups
    p.index('tasks_name_lower_idx').on(sql`lower(${table.name})`),
    p.index('tasks_name_simple_lower_idx').on(sql`lower(${table.nameSimple})`),
    p.index('tasks_name_technical_lower_idx').on(sql`lower(${table.nameTechnical})`),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
