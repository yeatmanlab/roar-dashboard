import * as p from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../common';
import { users } from './users';
import { classes } from './classes';
import { userRoleEnum } from '../enums';

const db = p.pgSchema('app');

/**
 * User Classes Table
 *
 * Stores information about the membership of a user in a class. By definition, a single user can be a member of
 * multiple classes, and a single class can have multiple users.
 */
export const userClasses = db.table(
  'user_classes',
  {
    userId: p
      .uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: p
      .uuid()
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),

    role: userRoleEnum().notNull(),

    enrollmentStart: p.timestamp({ withTimezone: true }).notNull(),
    enrollmentEnd: p.timestamp({ withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // Primary key
    p.primaryKey({ name: 'user_classes_pk', columns: [table.userId, table.classId] }),

    // Indexes
    // - User lookup by class ID
    p.index('user_classes_class_idx').on(table.classId),

    // Constraints
    // - Ensure enrollmentEnd is after enrollmentStart if enrollmentEnd is not null
    p.check(
      'user_classes_enrollment_dates_valid',
      sql`${table.enrollmentEnd} IS NULL OR ${table.enrollmentStart} < ${table.enrollmentEnd}`,
    ),
  ],
);

export type UserClass = typeof userClasses.$inferSelect;
export type NewUserClass = typeof userClasses.$inferInsert;
