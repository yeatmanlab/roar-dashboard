export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SITE_ADMIN: 'site_admin',
  ADMIN: 'admin',
  RESEARCH_ASSISTANT: 'research_assistant',
  PARTICIPANT: 'participant',
} as const;

export const PERMISSION_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  EXCLUDE: 'exclude',
} as const;
