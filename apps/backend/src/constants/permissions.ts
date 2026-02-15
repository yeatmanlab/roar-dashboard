/**
 * Permission Constants
 *
 * Defines all permissions available in the system.
 * Ported from roar-firekit for consistency across the codebase.
 *
 * Permissions follow the pattern: resource.action or resource.subresource.action
 * Wildcard permissions (*.ALL) grant all permissions for that resource.
 */

export const Permissions = {
  Reports: {
    Score: {
      ALL: 'reports.score.*',
      READ: 'reports.score.read',
      READ_COMPOSITE: 'reports.score.read_composite',
    },
    Progress: {
      ALL: 'reports.progress.*',
      READ: 'reports.progress.read',
    },
    Student: {
      ALL: 'reports.student.*',
      READ: 'reports.student.read',
    },
  },
  Organizations: {
    ALL: 'organizations.*',
    LIST: 'organizations.list',
    CREATE: 'organizations.create',
    UPDATE: 'organizations.update',
  },
  Classes: {
    ALL: 'classes.*',
    LIST: 'classes.list',
  },
  Groups: {
    ALL: 'groups.*',
    LIST: 'groups.list',
  },
  TaskVariants: {
    ALL: 'task_variants.*',
    LIST: 'task_variants.list',
  },
  Administrations: {
    ALL: 'administrations.*',
    LIST: 'administrations.list',
    READ: 'administrations.read',
    CREATE: 'administrations.create',
    UPDATE: 'administrations.update',
  },
  Administrators: {
    ALL: 'administrators.*',
    READ: 'administrators.read',
    CREATE: 'administrators.create',
    UPDATE: 'administrators.update',
    Credentials: {
      UPDATE: 'administrators.credentials.update',
    },
  },
  Profile: {
    ALL: 'profile.*',
    READ: 'profile.read',
  },
  Users: {
    ALL: 'users.*',
    LIST: 'users.list',
    CREATE: 'users.create',
    UPDATE: 'users.update',
    UNENROLL: 'users.unenroll',
    SET_PID: 'users.set_pid',
    Credentials: {
      UPDATE: 'users.credentials.update',
    },
  },
  Tasks: {
    ALL: 'tasks.*',
    CREATE: 'tasks.create',
    UPDATE: 'tasks.update',
    LAUNCH: 'tasks.launch',
  },
  Runs: {
    ALL: 'runs.*',
    DELETE: 'runs.delete',
    Scores: {
      MARK_INELIGIBLE: 'runs.scores.mark_ineligible',
    },
  },
  TestData: {
    CREATE: 'testdata.create',
  },
} as const;

/**
 * Helper type to recursively extract all string values from a nested const object.
 */
type DeepValues<T> = T extends string ? T : T extends object ? { [K in keyof T]: DeepValues<T[K]> }[keyof T] : never;

/**
 * Permission type - union of all permission string literals.
 */
export type Permission = DeepValues<typeof Permissions>;
