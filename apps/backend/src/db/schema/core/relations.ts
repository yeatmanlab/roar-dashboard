import { relations } from 'drizzle-orm';
import { users } from './users';
import { orgs } from './orgs';
import { usersOrgs } from './users-orgs';

/**
 * User Relations
 *
 * Drizzle relation definition for any membership of a user in a foreign table.
 */
export const usersRelations = relations(users, ({ many }) => ({
  orgMemberships: many(usersOrgs),
}));

/**
 * Org Relations
 *
 * Drizzle relation definition for any membership of an org in a foreign table.
 */
export const orgsRelations = relations(orgs, ({ many }) => ({
  userMemberships: many(usersOrgs),
}));

/**
 * Users Orgs relationship
 *
 * Drizzle relation definition for users <> users_orgs <> orgs, where users_orgs is the join table.
 */
export const usersOrgsRelations = relations(usersOrgs, ({ one }) => ({
  user: one(users, { fields: [usersOrgs.userId], references: [users.id] }),
  org: one(orgs, { fields: [usersOrgs.orgId], references: [orgs.id] }),
}));
