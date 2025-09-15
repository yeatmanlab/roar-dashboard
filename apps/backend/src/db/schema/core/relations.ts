import { relations } from 'drizzle-orm';
import { classes } from './classes';
import { groups } from './groups';
import { orgs } from './orgs';
import { users } from './users';
import { usersClasses } from './users-classes';
import { usersGroups } from './users-groups';
import { usersOrgs } from './users-orgs';

/**
 * User Relations
 *
 * Drizzle relation definition for any membership of a user in a foreign table.
 */
export const usersRelations = relations(users, ({ many }) => ({
  orgs: many(usersOrgs),
  groups: many(usersGroups),
  classes: many(usersClasses),
}));

/**
 * Class Relations
 *
 * Drizzle relation definition for any membership of a class in a foreign table.
 */
export const classesRelations = relations(classes, ({ many }) => ({
  users: many(usersClasses),
}));

/**
 * User Classes relationship
 *
 * Drizzle relation definition for users <> users_classes <> classes, where users_classes is the join table.
 */
export const usersClassesRelations = relations(usersClasses, ({ one }) => ({
  user: one(users, { fields: [usersClasses.userId], references: [users.id] }),
  class: one(classes, { fields: [usersClasses.classId], references: [classes.id] }),
}));

/**
 * Group Relations
 *
 * Drizzle relation definition for any membership of a group in a foreign table.
 */
export const groupsRelations = relations(groups, ({ many }) => ({
  users: many(usersGroups),
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
  users: many(usersOrgs),
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
