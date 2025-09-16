import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';

const db = p.pgSchema('app');

/**
 * Runs Table
 *
 * Stores information about runs in the system. For every assessment taken by a user, a run is created. Runs and
 * corresponding trials are stored in the assessment database without any PII for research purposes.
 */

export const runs = db.table('runs', {
  id: p
    .uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  userId: p.uuid().notNull(),
  taskId: p.uuid().notNull(),
  taskVariantId: p.uuid().notNull(),
  taskVersion: p.text(), //@TODO Should we enforce format? vx.x.x

  administrationId: p.uuid().notNull(),
  assignmentId: p.uuid().notNull(),

  bestRun: p.boolean().notNull().default(false),
  reliableRun: p.boolean().notNull().default(false),

  engagementFlags: p.jsonb(),
  metadata: p.jsonb(),

  excludeFromResearch: p.boolean().notNull().default(false),

  ...timestamps,

  completedAt: p.timestamp({ withTimezone: true }),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
