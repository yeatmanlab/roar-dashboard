import * as p from 'drizzle-orm/pg-core';

export const timestamps = {
  updatedAt: p.timestamp({ withTimezone: true }),
  createdAt: p.timestamp({ withTimezone: true }).defaultNow().notNull(),
};
