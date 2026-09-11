/**
 * Type guard for Firebase errors.
 *
 * Firebase Admin SDK throws plain objects with a `code` string property rather
 * than instances of a named class, so `instanceof` checks are not reliable.
 * This guard narrows `unknown` to a type that exposes `code` safely.
 *
 * @param error - The caught value from a catch block
 * @returns true if the error is an object with a string `code` property
 */
export function isFirebaseError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}
