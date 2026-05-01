/**
 * Service-owned types for the report domain.
 *
 * These decouple the service layer from the API contract types. The controller
 * maps between contract types (HTTP boundary) and these service types (domain
 * boundary). TypeScript's structural typing handles compatibility when the
 * shapes are identical.
 */

import type { ParsedFilter } from '../../types/filter';
import type { ProgressStatus } from '../../constants/progress-status';
export type { ParsedFilter, ProgressStatus };

/** Scope type for report queries. */
export type ScopeType = 'district' | 'school' | 'class' | 'group';

/**
 * Query input for listProgressStudents.
 * The controller maps from the contract's ProgressStudentsQuery to this type.
 */
export interface ProgressStudentsInput {
  scopeType: ScopeType;
  scopeId: string;
  page: number;
  perPage: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filter: ParsedFilter[];
}

/** Static sort fields for progress students. */
export type ProgressStudentsSortField = 'user.lastName' | 'user.firstName' | 'user.username' | 'user.grade';

/** Static filter fields for progress students. */
export type ProgressStudentsFilterField =
  | 'user.grade'
  | 'user.firstName'
  | 'user.lastName'
  | 'user.username'
  | 'user.email';

/** Task metadata in service results. */
export interface ServiceTaskMetadata {
  taskId: string;
  taskSlug: string;
  taskName: string;
  orderIndex: number;
}

/** Per-task progress entry in service results. */
export interface ServiceProgressEntry {
  status: ProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
}

/** User info in progress results. */
export interface ServiceUserInfo {
  userId: string;
  assessmentPid: string | null;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  grade: string | null;
  schoolName?: string | null;
}

/** A student row in progress results. */
export interface ServiceProgressStudent {
  user: ServiceUserInfo;
  progress: Record<string, ServiceProgressEntry>;
}

/** Return type for listProgressStudents. */
export interface ProgressStudentsResult {
  tasks: ServiceTaskMetadata[];
  items: ServiceProgressStudent[];
  totalItems: number;
}

/** Query input for getProgressOverview. */
export interface ProgressOverviewInput {
  scopeType: ScopeType;
  scopeId: string;
}

/** Per-task aggregation in overview results. */
export interface ServiceTaskOverview {
  taskId: string;
  taskSlug: string;
  taskName: string;
  orderIndex: number;
  /** 7-level per-status counts */
  assignedRequired: number;
  assignedOptional: number;
  startedRequired: number;
  startedOptional: number;
  completedRequired: number;
  completedOptional: number;
  /** Convenience totals by progress axis */
  assigned: number;
  started: number;
  completed: number;
  /** Convenience totals by requirement axis */
  required: number;
  optional: number;
}

/** Return type for getProgressOverview. */
export interface ProgressOverviewResult {
  totalStudents: number;
  /** Students with at least one required task — denominator for assignment-level counts. */
  studentsWithRequiredTasks: number;
  /** Students where ALL required tasks are still at assigned-required. */
  studentsAssigned: number;
  /** Students with at least one required task started/completed but not all completed. */
  studentsStarted: number;
  /** Students where ALL required tasks are at completed-required. */
  studentsCompleted: number;
  byTask: ServiceTaskOverview[];
  computedAt: string;
}

/** Query input for getScoreOverview. */
export interface ScoreOverviewInput {
  scopeType: ScopeType;
  scopeId: string;
  filter: ParsedFilter[];
}

/** Support level distribution counts for a single category. */
export interface ServiceSupportLevelEntry {
  count: number;
}

/** Per-task score overview with support level distribution. */
export interface ServiceTaskScoreOverview {
  taskId: string;
  taskSlug: string;
  taskName: string;
  orderIndex: number;
  /** Number of students with a completed run and classifiable scores */
  totalAssessed: number;
  /** Students with no completed run, split by assignment status */
  totalNotAssessed: {
    required: number;
    optional: number;
  };
  /** Support level distribution (only for assessed students) */
  supportLevels: {
    achievedSkill: ServiceSupportLevelEntry;
    developingSkill: ServiceSupportLevelEntry;
    needsExtraSupport: ServiceSupportLevelEntry;
  };
}

/** Return type for getScoreOverview. */
export interface ScoreOverviewResult {
  totalStudents: number;
  tasks: ServiceTaskScoreOverview[];
  /** ISO 8601 timestamp when the aggregation was computed */
  computedAt: string;
}
