/**
 * Constants for organization export functionality
 */

// Export state constants
export const EXPORT_STATES = {
  EXPORTING_ORG_USERS: 'exportingOrgUsers',
};

// Warning level constants
export const WARNING_LEVELS = {
  NONE: 'none',
  NORMAL: 'normal',
  STRONG: 'strong',
  CRITICAL: 'critical',
};

// Export status constants
export const EXPORT_STATUS = {
  IDLE: 'idle',
  IN_PROGRESS: 'inProgress',
  COMPLETE: 'complete',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

// Event name constants
export const ORG_EXPORT_EVENTS = {
  EXPORT_ORG_USERS: 'export-org-users',
};
