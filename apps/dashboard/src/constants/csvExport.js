/**
 * CSV Export
 *
 * @constant {number} CSV_EXPORT_WARNING_THRESHOLD - Show warning modal at this count
 * @constant {number} CSV_EXPORT_STRONG_WARNING_THRESHOLD - Show strong warning modal at this count
 * @constant {number} CSV_EXPORT_CRITICAL_THRESHOLD - Show critical warning for very large exports
 * @constant {number} CSV_EXPORT_BATCH_SIZE - Number of records per batch for very large exports
 */
export const CSV_EXPORT_WARNING_THRESHOLD = 10000;
export const CSV_EXPORT_STRONG_WARNING_THRESHOLD = 20000;
export const CSV_EXPORT_CRITICAL_THRESHOLD = 50000;
export const CSV_EXPORT_BATCH_SIZE = 10000;
export const CSV_EXPORT_STATIC_COLUMNS = [
  'Username',
  'Email',
  'First',
  'Last',
  'Grade',
  'PID',
  'School',
  'Start Date',
  'Completion Date',
];
