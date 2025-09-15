/**
 * Rostering Entity Status Enum
 *
 * Enumerates the available rostering entity statuses following the OneRoster spec.
 */
enum rosteringEntityStatusEnum {
  ENROLLED = 'enrolled',
  UNENROLLED = 'unenrolled',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export default rosteringEntityStatusEnum;
