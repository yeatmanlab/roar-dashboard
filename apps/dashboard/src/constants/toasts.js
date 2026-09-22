export const TOAST_SEVERITIES = Object.freeze({
  SUCCESS: 'success',
  INFO: 'info',
  ERROR: 'error',
  WARNING: 'warn',
});

export const TOAST_DEFAULT_LIFE_DURATION = 3000;

/**
 * Longer life for messages the user has to read and act on — validation failures that name a
 * field or explain how to fix a file. The 3s default is enough to notice a success, not enough
 * to read a sentence and do something about it.
 */
export const TOAST_LONG_LIFE_DURATION = 12000;
