import { relations } from 'drizzle-orm';
import { groups } from './groups';
import { users } from './users';
import { orgs } from './orgs';
import { usersOrgs } from './users-orgs';
import { usersGroups } from './users-groups';

/**
 * User Relations
 *
 * Drizzle relation definition for any membership of a user in a foreign table.
 */
export const usersRelations = relations(users, ({ many }) => ({
  org: many(usersOrgs),
  group: many(usersGroups),
}));

/**
 * Group Relations
 *
 * Drizzle relation definition for any membership of a group in a foreign table.
 */
export const groupsRelations = relations(groups, ({ many }) => ({
  user: many(usersGroups),
}));

/**
 * Users Groups relationship
 *
 * Drizzle relation definition for users <> users_groups <> groups, where users_groups is the join table.
 */
export const usersGroupsRelations = relations(usersGroups, ({ one }) => ({
  user: one(users, { fields: [usersGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [usersGroups.groupId], references: [groups.id] }),
}));

/**
 * Org Relations
 *
 * Drizzle relation definition for any membership of an org in a foreign table.
 */
export const orgsRelations = relations(orgs, ({ many }) => ({
  user: many(usersOrgs),
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
