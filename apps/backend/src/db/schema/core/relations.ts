import { relations } from 'drizzle-orm';
import { agreements } from './agreements';
import { agreementVersions } from './agreement-versions';
import { classes } from './classes';
import { courses } from './courses';
import { families } from './families';
import { groups } from './groups';
import { orgs } from './orgs';
import { users } from './users';
import { userAgreements } from './user-agreements';
import { userClasses } from './user-classes';
import { userFamilies } from './user-families';
import { userGroups } from './user-groups';
import { userOrgs } from './user-orgs';
import { tasks } from './tasks';
import { taskVariants } from './task-variants';
import { taskVariantParameters } from './task-variant-parameters';
import { taskBundles } from './task-bundles';
import { taskBundleVariants } from './task-bundle-variants';
import { administrations } from './administrations';
import { administrationTaskVariants } from './administration-task-variants';
import { administrationAgreements } from './administration-agreements';
import { administrationClasses } from './administration-classes';
import { administrationGroups } from './administration-groups';
import { administrationOrgs } from './administration-orgs';

/**
 * Core Schema Relations
 *
 * Defines Drizzle ORM relations for the core database tables.
 * These enable the relational query API (e.g., `with: { classes: true }`).
 */

/**
 * Org Relations
 *
 * Organizations form a hierarchical structure with self-referencing parent/child relationships.
 * Classes have two references to orgs (school and district), requiring relationName aliasing.
 */
export const orgsRelations = relations(orgs, ({ one, many }) => ({
  parent: one(orgs, {
    fields: [orgs.parentOrgId],
    references: [orgs.id],
    relationName: 'orgHierarchy',
  }),
  children: many(orgs, { relationName: 'orgHierarchy' }),
  users: many(userOrgs),
  administrations: many(administrationOrgs),
  courses: many(courses),
  schoolClasses: many(classes, { relationName: 'schoolClasses' }),
  districtClasses: many(classes, { relationName: 'districtClasses' }),
}));

/**
 * Group Relations
 *
 * Groups form a hierarchical structure with self-referencing parent/child relationships.
 */
export const groupsRelations = relations(groups, ({ one, many }) => ({
  parent: one(groups, {
    fields: [groups.parentGroupId],
    references: [groups.id],
    relationName: 'groupHierarchy',
  }),
  children: many(groups, { relationName: 'groupHierarchy' }),
  users: many(userGroups),
  administrations: many(administrationGroups),
}));

/**
 * Course Relations
 */
export const coursesRelations = relations(courses, ({ one, many }) => ({
  org: one(orgs, { fields: [courses.orgId], references: [orgs.id] }),
  classes: many(classes),
}));

/**
 * Class Relations
 *
 * Classes reference both a school and district org, requiring relationName aliasing.
 */
export const classesRelations = relations(classes, ({ one, many }) => ({
  course: one(courses, { fields: [classes.courseId], references: [courses.id] }),
  school: one(orgs, {
    fields: [classes.schoolId],
    references: [orgs.id],
    relationName: 'schoolClasses',
  }),
  district: one(orgs, {
    fields: [classes.districtId],
    references: [orgs.id],
    relationName: 'districtClasses',
  }),
  users: many(userClasses),
  administrations: many(administrationClasses),
}));

/**
 * Family Relations
 */
export const familiesRelations = relations(families, ({ many }) => ({
  users: many(userFamilies),
}));

/**
 * Agreement Relations
 */
export const agreementsRelations = relations(agreements, ({ many }) => ({
  administrations: many(administrationAgreements),
  versions: many(agreementVersions),
}));

export const agreementVersionsRelations = relations(agreementVersions, ({ one, many }) => ({
  agreement: one(agreements, { fields: [agreementVersions.agreementId], references: [agreements.id] }),
  users: many(userAgreements),
}));

/**
 * Task Relations
 */
export const tasksRelations = relations(tasks, ({ many }) => ({
  variants: many(taskVariants),
}));

export const taskVariantsRelations = relations(taskVariants, ({ one, many }) => ({
  task: one(tasks, { fields: [taskVariants.taskId], references: [tasks.id] }),
  parameters: many(taskVariantParameters),
  administrations: many(administrationTaskVariants),
  bundleVariants: many(taskBundleVariants),
}));

export const taskVariantParametersRelations = relations(taskVariantParameters, ({ one }) => ({
  taskVariant: one(taskVariants, { fields: [taskVariantParameters.taskVariantId], references: [taskVariants.id] }),
}));

export const taskBundlesRelations = relations(taskBundles, ({ many }) => ({
  variants: many(taskBundleVariants),
}));

export const taskBundleVariantsRelations = relations(taskBundleVariants, ({ one }) => ({
  taskBundle: one(taskBundles, { fields: [taskBundleVariants.taskBundleId], references: [taskBundles.id] }),
  taskVariant: one(taskVariants, { fields: [taskBundleVariants.taskVariantId], references: [taskVariants.id] }),
}));

/**
 * Administration Relations
 */
export const administrationsRelations = relations(administrations, ({ one, many }) => ({
  createdByUser: one(users, { fields: [administrations.createdBy], references: [users.id] }),
  agreements: many(administrationAgreements),
  classes: many(administrationClasses),
  groups: many(administrationGroups),
  orgs: many(administrationOrgs),
  taskVariants: many(administrationTaskVariants),
}));

export const administrationAgreementsRelations = relations(administrationAgreements, ({ one }) => ({
  administration: one(administrations, {
    fields: [administrationAgreements.administrationId],
    references: [administrations.id],
  }),
  agreement: one(agreements, {
    fields: [administrationAgreements.agreementId],
    references: [agreements.id],
  }),
}));

export const administrationClassesRelations = relations(administrationClasses, ({ one }) => ({
  administration: one(administrations, {
    fields: [administrationClasses.administrationId],
    references: [administrations.id],
  }),
  class: one(classes, {
    fields: [administrationClasses.classId],
    references: [classes.id],
  }),
}));

export const administrationGroupsRelations = relations(administrationGroups, ({ one }) => ({
  administration: one(administrations, {
    fields: [administrationGroups.administrationId],
    references: [administrations.id],
  }),
  group: one(groups, {
    fields: [administrationGroups.groupId],
    references: [groups.id],
  }),
}));

export const administrationOrgsRelations = relations(administrationOrgs, ({ one }) => ({
  administration: one(administrations, {
    fields: [administrationOrgs.administrationId],
    references: [administrations.id],
  }),
  org: one(orgs, {
    fields: [administrationOrgs.orgId],
    references: [orgs.id],
  }),
}));

export const administrationTaskVariantsRelations = relations(administrationTaskVariants, ({ one }) => ({
  administration: one(administrations, {
    fields: [administrationTaskVariants.administrationId],
    references: [administrations.id],
  }),
  taskVariant: one(taskVariants, {
    fields: [administrationTaskVariants.taskVariantId],
    references: [taskVariants.id],
  }),
}));

/**
 * User Relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  orgs: many(userOrgs),
  groups: many(userGroups),
  classes: many(userClasses),
  families: many(userFamilies),
  agreements: many(userAgreements),
}));

export const userOrgsRelations = relations(userOrgs, ({ one }) => ({
  user: one(users, { fields: [userOrgs.userId], references: [users.id] }),
  org: one(orgs, { fields: [userOrgs.orgId], references: [orgs.id] }),
}));

export const userGroupsRelations = relations(userGroups, ({ one }) => ({
  user: one(users, { fields: [userGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [userGroups.groupId], references: [groups.id] }),
}));

export const userClassesRelations = relations(userClasses, ({ one }) => ({
  user: one(users, { fields: [userClasses.userId], references: [users.id] }),
  class: one(classes, { fields: [userClasses.classId], references: [classes.id] }),
}));

export const userFamiliesRelations = relations(userFamilies, ({ one }) => ({
  user: one(users, { fields: [userFamilies.userId], references: [users.id] }),
  family: one(families, { fields: [userFamilies.familyId], references: [families.id] }),
}));

export const userAgreementsRelations = relations(userAgreements, ({ one }) => ({
  user: one(users, { fields: [userAgreements.userId], references: [users.id] }),
  agreementVersion: one(agreementVersions, {
    fields: [userAgreements.agreementVersionId],
    references: [agreementVersions.id],
  }),
}));
