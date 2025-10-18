/**
 * Constants for organization export functionality
 */

// Warning level constants
export const WARNING_LEVELS = {
  NONE: 'none',
  NORMAL: 'normal',
  STRONG: 'strong',
  CRITICAL: 'critical',
};

// Event name constants
export const ORG_EXPORT_EVENTS = {
  EXPORT_ORG_USERS: 'export-org-users',
};

// Export phase/status constants
export const EXPORT_PHASE = {
  IDLE: 'idle',
  IN_PROGRESS: 'inProgress',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};
