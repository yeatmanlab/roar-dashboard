import * as p from 'drizzle-orm/pg-core';
import { timestamps } from '../common';
import { userAssignments } from './user-assignments';
import { taskVariants } from './task-variants';
import { assignmentProgressEnum } from '../enums';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * User Assignment Progress Table
 *
 * Stores information about the progress of any given user assignment.
 */
export const userAssignmentProgress = db.table(
  'user_assignment_progress',
  {
    userAssignmentId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => userAssignments.id),

    taskVariantId: p
      .uuid()
      .notNull()
      .references((): AnyPgColumn => taskVariants.id),

    progress: assignmentProgressEnum().notNull(),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({
      name: 'user_assignment_progress_pkey',
      columns: [table.userAssignmentId, table.taskVariantId],
    }),

    // Indexes
    // - Lookups from either side
    p.index('user_assignments_progress_user_idx').on(table.userAssignmentId),
    p.index('user_assignments_progress_task_variant_idx').on(table.taskVariantId),

    // - Lookup by assignment and progress
    p.index('user_assignment_progress_user_assignment_progress_idx').on(table.userAssignmentId, table.progress),
  ],
);

export type UserAssignmentProgress = typeof userAssignmentProgress.$inferSelect;
export type NewUserAssignmentProgress = typeof userAssignmentProgress.$inferInsert;
