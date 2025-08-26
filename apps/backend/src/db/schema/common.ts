import * as p from "drizzle-orm/pg-core";

export const timestamps = {
  updated_at: p.timestamp({ withTimezone: true }),
  created_at: p.timestamp({ withTimezone: true }).defaultNow().notNull(),
}