import * as p from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamps } from "../common";

export const users = p.pgTable("users", {
  id: p.uuid().default(sql`gen_random_uuid()`).primaryKey(),
  authId: p.varchar().unique().notNull(),
  email: p.varchar().unique().notNull(),
  username: p.varchar(),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;