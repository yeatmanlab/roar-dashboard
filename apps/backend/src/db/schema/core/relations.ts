import { relations } from 'drizzle-orm';
import { agreements } from './agreements';
import { agreementVersions } from './agreement-versions';
import { classes } from './classes';
import { groups } from './groups';
import { orgs } from './orgs';
import { users } from './users';
import { userAgreements } from './user-agreements';
import { userClasses } from './user-classes';
import { userGroups } from './user-groups';
import { userOrgs } from './user-orgs';

/**
 * Class Relations
 *
 * Drizzle relation definition for any membership of a class in a foreign table.
 */
export const classesRelations = relations(classes, ({ many }) => ({
  users: many(userClasses),
}));

/**
 * Group Relations
 *
 * Drizzle relation definition for any membership of a group in a foreign table.
 */
export const groupsRelations = relations(groups, ({ many }) => ({
  users: many(userGroups),
}));

/**
 * Org Relations
 *
 * Drizzle relation definition for any membership of an org in a foreign table.
 */
export const orgsRelations = relations(orgs, ({ many }) => ({
  users: many(userOrgs),
}));

/**
 * Agreements Relations
 *
 * Drizzle relation definition for any membership of an agreement in a foreign table.
 */
export const agreementsRelations = relations(agreements, ({ many }) => ({
  versions: many(agreementVersions),
}));

/**
 * Agreement Versions Relations
 *
 * Drizzle relation definition for any membership of an agreement version in a foreign table.
 */
export const agreementVersionsRelations = relations(agreementVersions, ({ one }) => ({
  agreement: one(agreements, { fields: [agreementVersions.agreementId], references: [agreements.id] }),
}));

/**
 * User Relations
 *
 * Drizzle relation definition for any membership of a user in a foreign table.
 */
export const usersRelations = relations(users, ({ many }) => ({
  orgs: many(userOrgs),
  groups: many(userGroups),
  classes: many(userClasses),
}));

/**
 * User Classes relationship
 *
 * Drizzle relation definition for users <> user_classes <> classes, where user_classes is the join table.
 */
export const userClassesRelations = relations(userClasses, ({ one }) => ({
  user: one(users, { fields: [userClasses.userId], references: [users.id] }),
  class: one(classes, { fields: [userClasses.classId], references: [classes.id] }),
}));

/**
 * User Groups relationship
 *
 * Drizzle relation definition for users <> user_groups <> groups, where user_groups is the join table.
 */
export const userGroupsRelations = relations(userGroups, ({ one }) => ({
  user: one(users, { fields: [userGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [userGroups.groupId], references: [groups.id] }),
}));

/**
 * User Orgs relationship
 *
 * Drizzle relation definition for users <> user_orgs <> orgs, where user_orgs is the join table.
 */
export const userOrgsRelations = relations(userOrgs, ({ one }) => ({
  user: one(users, { fields: [userOrgs.userId], references: [users.id] }),
  org: one(orgs, { fields: [userOrgs.orgId], references: [orgs.id] }),
}));

/**
 * User Agreements relationship
 *
 * Drizzle relation definition for users <> user_agreements <> agreement_versions, where user_agreements is the join
 * table.
 */
export const userAgreementsRelations = relations(userAgreements, ({ one }) => ({
  user: one(users, { fields: [userAgreements.userId], references: [users.id] }),
  agreementVersion: one(agreementVersions, {
    fields: [userAgreements.agreementVersionId],
    references: [agreementVersions.id],
  }),
}));
