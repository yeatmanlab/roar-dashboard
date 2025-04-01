export const TOAST_SEVERITIES = Object.freeze({
  SUCCESS: 'success',
  INFO: 'info',
  ERROR: 'error',
} as const);

export type ToastSeverity = typeof TOAST_SEVERITIES[keyof typeof TOAST_SEVERITIES];

export const TOAST_DEFAULT_LIFE_DURATION = 3000; 