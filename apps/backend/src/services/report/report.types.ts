/**
 * Service-owned types for the report domain.
 *
 * These decouple the service layer from the API contract types. The controller
 * maps between contract types (HTTP boundary) and these service types (domain
 * boundary). TypeScript's structural typing handles compatibility when the
 * shapes are identical.
 */

import type { ParsedFilter } from '../../types/filter';
export type { ParsedFilter };

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

/** Progress status values. */
export type ProgressStatus = 'assigned' | 'started' | 'completed' | 'optional';

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
