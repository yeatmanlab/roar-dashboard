import * as p from 'drizzle-orm/pg-core';
import AuthProvider from '../../enums/auth-provider.enum';
import Grade from '../../enums/grade.enum';
import SchoolLevel from '../../enums/school-level.enum';
import UserType from '../../enums/user-type.enum';
import FreeReducedLunchStatus from '../../enums/frl-status.enum';
import AgreementType from '../../enums/agreement-type.enum';
import AssignmentProgress from '../../enums/assignment-progress.enum';
import ClassType from '../../enums/class-type.enum';
import GroupType from '../../enums/group-type.enum';
import OrgType from '../../enums/org-type.enum';
import RosteringProvider from '../../enums/rostering-provider.enum';
import RosteringEntityType from '../../enums/rostering-entity-type.enum';
import RosteringEntityStatus from '../../enums/rostering-entity-status.enum';
import TrialInteractionType from '../../enums/trial-interaction-type.enum';
import UserFamilyRole from '../../enums/user-family-role.enum';
import UserRole from '../../enums/user-role.enum';
import TaskVariantStatus from '../../enums/task-variant-status.enum';

/**
 * Helper function to convert a TS enum to a pgEnum
 *
 * @param enumVal – The TS enum to convert to a pgEnum.
 * @returns A pgEnum
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enumToPgEnum<T extends Record<string, any>>(enumVal: T): [T[keyof T], ...T[keyof T][]] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Object.values(enumVal).map((value: any) => `${value}`) as any;
}

/**
 * Postgres Enumerations
 *
 * Exports all TS enums relevant to the database schema as Postgres enums using our enumToPgEnum helper function.
 */

const db = p.pgSchema('app');

export const agreementTypeEnum = db.enum('agreement_type', enumToPgEnum(AgreementType));

export const assignmentProgressEnum = db.enum('assignment_progress', enumToPgEnum(AssignmentProgress));

export const authProviderEnum = db.enum('auth_provider', enumToPgEnum(AuthProvider));

export const classTypeEnum = db.enum('class_type', enumToPgEnum(ClassType));

export const freeReducedLunchStatusEnum = db.enum('free_reduced_lunch_status', enumToPgEnum(FreeReducedLunchStatus));

export const gradeEnum = db.enum('grade', enumToPgEnum(Grade));

export const groupTypeEnum = db.enum('group_type', enumToPgEnum(GroupType));

export const orgTypeEnum = db.enum('org_type', enumToPgEnum(OrgType));

export const rosteringProviderEnum = db.enum('rostering_provider', enumToPgEnum(RosteringProvider));

export const rosteringEntityTypeEnum = db.enum('rostering_entity_type', enumToPgEnum(RosteringEntityType));

export const rosteringEntityStatusEnum = db.enum('rostering_entity_status', enumToPgEnum(RosteringEntityStatus));

export const schoolLevelEnum = db.enum('school_level', enumToPgEnum(SchoolLevel));

export const trialInteractionTypeEnum = db.enum('trial_interaction_type', enumToPgEnum(TrialInteractionType));

export const userFamilyRoleEnum = db.enum('user_family_role', enumToPgEnum(UserFamilyRole));

export const userRoleEnum = db.enum('user_role', enumToPgEnum(UserRole));

export const userTypeEnum = db.enum('user_type', enumToPgEnum(UserType));

export const taskVariantStatusEnum = db.enum('task_variant_status', enumToPgEnum(TaskVariantStatus));
