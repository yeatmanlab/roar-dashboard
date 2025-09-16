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
import { tasks } from './tasks';
import { taskVariants } from './task-variants';
import { taskVariantParameters } from './task-variant-parameters';
import { taskBundles } from './task-bundles';
import { taskBundleVariants } from './task-bundle-variants';

/**
 * Class Relations
 */
export const classesRelations = relations(classes, ({ many }) => ({
  users: many(userClasses),
}));

/**
 * Group Relations
 */
export const groupsRelations = relations(groups, ({ many }) => ({
  users: many(userGroups),
}));

/**
 * Org Relations
 */
export const orgsRelations = relations(orgs, ({ many }) => ({
  users: many(userOrgs),
}));

/**
 * Agreements Relations
 */
export const agreementsRelations = relations(agreements, ({ many }) => ({
  versions: many(agreementVersions),
}));

export const agreementVersionsRelations = relations(agreementVersions, ({ one }) => ({
  agreement: one(agreements, { fields: [agreementVersions.agreementId], references: [agreements.id] }),
}));

/**
 * Tasks Relations
 */
export const tasksRelations = relations(tasks, ({ many }) => ({
  variants: many(taskVariants),
}));

export const taskVariantsRelations = relations(taskVariants, ({ one }) => ({
  task: one(tasks, { fields: [taskVariants.taskId], references: [tasks.id] }),
}));

export const taskVariantParametersRelations = relations(taskVariantParameters, ({ one }) => ({
  taskVariant: one(taskVariants, { fields: [taskVariantParameters.taskVariantId], references: [taskVariants.id] }),
}));

export const taskBundlesRelations = relations(taskBundles, ({ many }) => ({
  variants: many(taskBundleVariants),
}));

export const taskBundleVariantsRelations = relations(taskBundleVariants, ({ one }) => ({
  taskBundle: one(taskBundles, { fields: [taskBundleVariants.taskBundleId], references: [taskBundles.id] }),
}));

/**
 * User Relationships
 */
export const usersRelations = relations(users, ({ many }) => ({
  orgs: many(userOrgs),
  groups: many(userGroups),
  classes: many(userClasses),
}));

export const userClassesRelations = relations(userClasses, ({ one }) => ({
  user: one(users, { fields: [userClasses.userId], references: [users.id] }),
  class: one(classes, { fields: [userClasses.classId], references: [classes.id] }),
}));

export const userGroupsRelations = relations(userGroups, ({ one }) => ({
  user: one(users, { fields: [userGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [userGroups.groupId], references: [groups.id] }),
}));

export const userOrgsRelations = relations(userOrgs, ({ one }) => ({
  user: one(users, { fields: [userOrgs.userId], references: [users.id] }),
  org: one(orgs, { fields: [userOrgs.orgId], references: [orgs.id] }),
}));

export const userAgreementsRelations = relations(userAgreements, ({ one }) => ({
  user: one(users, { fields: [userAgreements.userId], references: [users.id] }),
  agreement: one(agreementVersions, {
    fields: [userAgreements.agreementVersionId],
    references: [agreementVersions.id],
  }),
}));
