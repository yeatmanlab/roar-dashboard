/**
 * This file defines permissions for the dashboard.
 *
 * Permissions are defined as strings and organized into Permission Groups. These Permission Groups
 *   are characterized by features offered on the platform.
 */

export const SCORE_REPORT_PERMISSIONS = {
  VIEW: 'scorereport.view',
};

export const INDIVIDUAL_REPORT_PERMISSIONS = {
  VIEW: 'individuallreport.view',
};

export const REGISTER_STUDENT_PERMISSIONS = {
  VIEW: 'registerstudent.view',
  CREATE: 'registerstudent.create',
};

export const UNAUTHENTICATED_PERMISSIONS = {
  VIEW_SIGNIN: 'unauthenticated.view-signin',
  VIEW_SSO: 'unauthenticated.view-sso',
  VIEW_MAINTENANCE: 'unauthenticated.view-maintenance',
  VIEW_EMAIL_LINK: 'unauthenticated.view-email-link',
  VIEW_EMAIL_SENT: 'unauthenticated.view-email-sent',
  VIEW_REGISTER: 'unauthenticated.view-register',
};

export const SETTINGS_PERMISSIONS = {
  VIEW: 'settings.view',
  CHANGE_PASSWORD: 'settings.change-password',
  LINK_ACCOUNTS: 'settings.link-accounts',
};

export const TASK_MANAGER_PERMISSIONS = {
  VIEW: 'taskmanager.view',
};

export const TASK_PERMISSIONS = {
  LAUNCH_TASK: 'task.launch',
};
