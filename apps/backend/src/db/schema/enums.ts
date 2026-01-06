/**
 * Postgres Enumerations
 *
 * This file defines all database enums as Drizzle pgEnums.
 * These serve as the source of truth - TypeScript const objects
 * in src/enums/ are derived from these definitions.
 */
import * as p from 'drizzle-orm/pg-core';

const db = p.pgSchema('app');

/**
 * Agreement types for user consent flows.
 * - tos: Terms of Service
 * - assent: Minor's agreement (typically for students)
 * - consent: Guardian/parent consent
 */
export const agreementTypeEnum = db.enum('agreement_type', ['tos', 'assent', 'consent']);

/**
 * Stages of an assessment session.
 * - practice: Practice/warm-up phase before scoring begins
 * - test: Actual scored assessment phase
 */
export const assessmentStageEnum = db.enum('assessment_stage', ['practice', 'test']);

/**
 * Progress states for task assignments.
 * - assigned: Task has been assigned but not started
 * - started: User has begun the task
 * - completed: User has finished the task
 */
export const assignmentProgressEnum = db.enum('assignment_progress', ['assigned', 'started', 'completed']);

/**
 * Supported authentication providers.
 * - password: Traditional email/password authentication
 * - google: Google OAuth authentication
 * - oidc.clever: Clever SSO integration
 * - oidc.classlink: ClassLink SSO integration
 * - oidc.nycps: NYC Public Schools SSO integration
 */
export const authProviderEnum = db.enum('auth_provider', [
  'password',
  'google',
  'oidc.clever',
  'oidc.classlink',
  'oidc.nycps',
]);

/**
 * Class types following the OneRoster specification.
 * @see {@link https://www.imsglobal.org/oneroster-v11-final-specification}
 */
export const classTypeEnum = db.enum('class_type', ['homeroom', 'scheduled', 'other']);

/**
 * Free/Reduced lunch status for students.
 * Values are PascalCase to match OneRoster specification.
 */
export const freeReducedLunchStatusEnum = db.enum('free_reduced_lunch_status', ['Free', 'Reduced', 'Paid']);

/**
 * Grade levels for students.
 * Numeric grades (1-13) and named levels (PreKindergarten, Kindergarten, etc.)
 * Values match the OneRoster specification format.
 */
export const gradeEnum = db.enum('grade', [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  'PreKindergarten',
  'TransitionalKindergarten',
  'Kindergarten',
  'InfantToddler',
  'Preschool',
  'PostGraduate',
  'Ungraded',
  'Other',
  '', // Represents when grade is unspecified or unknown
]);

/**
 * Types of user groups.
 * - cohort: A group of users progressing together
 * - community: A community-based group
 * - business: A business/organizational group
 */
export const groupTypeEnum = db.enum('group_type', ['cohort', 'community', 'business']);

/**
 * Organization types following the OneRoster specification v1.1.
 * @see {@link https://www.imsglobal.org/oneroster-v11-final-specification#_Toc480452024}
 */
export const orgTypeEnum = db.enum('org_type', ['national', 'state', 'local', 'district', 'school', 'department']);

/**
 * Status of rostering sync operations for entities.
 * - enrolled: Successfully synced and active
 * - unenrolled: Removed from roster
 * - failed: Sync operation failed
 * - skipped: Entity was skipped during sync
 */
export const rosteringEntityStatusEnum = db.enum('rostering_entity_status', [
  'enrolled',
  'unenrolled',
  'failed',
  'skipped',
]);

/**
 * Types of entities that can be rostered.
 * Following OneRoster specification for entity types.
 */
export const rosteringEntityTypeEnum = db.enum('rostering_entity_type', ['org', 'class', 'course', 'user']);

/**
 * Supported rostering data providers.
 * - classlink: ClassLink roster sync
 * - clever: Clever roster sync
 * - dashboard: Manual entry via dashboard
 * - nycps: NYC Public Schools roster sync
 * - csv: CSV file import
 */
export const rosteringProviderEnum = db.enum('rostering_provider', [
  'classlink',
  'clever',
  'dashboard',
  'nycps',
  'csv',
]);

/**
 * Supported types of rostering runs.
 * - full: Complete sync of all data
 * - incremental: Sync of only changed data since last run
 * - retry: Re-attempt of failed entities from previous run
 */
export const rosteringRunTypeEnum = db.enum('rostering_run_type', ['full', 'incremental', 'retry']);

/**
 * School levels, typically derived from student grade.
 * - early_childhood: Pre-K and kindergarten
 * - elementary: Grades 1-5
 * - middle: Grades 6-8
 * - high: Grades 9-12
 * - postsecondary: Grade 13 and beyond
 */
export const schoolLevelEnum = db.enum('school_level', [
  'early_childhood',
  'elementary',
  'middle',
  'high',
  'postsecondary',
]);

/**
 * Types of assessment scores.
 * - computed: Derived/calculated score (e.g., percentile, standard score)
 * - raw: Raw score directly from assessment
 */
export const scoreTypeEnum = db.enum('score_type', ['computed', 'raw']);

/**
 * Publication status for task variants.
 * - DRAFT: Work in progress, not available to users
 * - PUBLISHED: Live and available for assessments
 * - DEPRECATED: No longer recommended for use
 */
export const taskVariantStatusEnum = db.enum('task_variant_status', ['draft', 'published', 'deprecated']);

/**
 * Types of user interactions during assessment trials.
 * Used for tracking engagement and detecting interruptions.
 */
export const trialInteractionTypeEnum = db.enum('trial_interaction_type', [
  'focus',
  'blur',
  'fullscreen_enter',
  'fullscreen_exit',
]);

/**
 * Roles a user can have within a family group.
 * - parent: Guardian/parent account
 * - child: Child/student account linked to parent
 * - guest: Guest access within family
 */
export const userFamilyRoleEnum = db.enum('user_family_role', ['parent', 'child']);

/**
 * Administrative roles for dashboard access.
 * - site_administrator: Full access to all site settings and data
 * - administrator: School/district level admin access
 * - teacher: Educator access with class management
 * - student: Learner access with limited permissions
 */
export const userRoleEnum = db.enum('user_role', ['site_administrator', 'administrator', 'teacher', 'student']);

/**
 * User types derived from the OneRoster specification.
 * - student: Student/learner
 * - educator: Teacher/instructor
 * - caregiver: Parent/guardian
 * - admin: Administrative staff
 * - super_admin: Platform support with unrestricted access (bypasses RBAC)
 */
export const userTypeEnum = db.enum('user_type', ['student', 'educator', 'caregiver', 'admin', 'super_admin']);
