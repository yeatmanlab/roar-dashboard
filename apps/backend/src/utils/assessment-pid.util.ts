import { str as crc32 } from 'crc-32';

/**
 * Generate a CRC32 hex checksum of a string.
 *
 * Replicates the `crc32String` utility from `@bdelab/roar-firekit` (firestore/util.js)
 * so that the backend can generate identical assessment PIDs without importing the
 * client-side firekit package.
 *
 * @param input - The string to checksum
 * @returns 32-bit unsigned CRC32 as a lowercase hex string
 */
export function crc32String(input: string): string {
  // crc-32 returns a signed 32-bit integer; convert to unsigned before hex-encoding,
  // matching the roarfirekit `toUint32(x) = modulo(x, 2^32)` implementation.
  const signed = crc32(input);
  const unsigned = ((signed % 2 ** 32) + 2 ** 32) % 2 ** 32;
  return unsigned.toString(16);
}

/**
 * Options for generating an assessment PID.
 *
 * The backend variant takes a plain `userId` string rather than a user object,
 * since callers already have the value and lodash `_get` is not needed.
 */
export interface AssessmentPidOptions {
  /**
   * The user's unique identifier to hash.
   *
   * In the ROAR platform this is the user's email (or synthetic username),
   * matching the algorithm used by the legacy `generateAssessmentPid` cloud function.
   */
  userId: string;
  /** Optional district abbreviation to include in the PID */
  districtPrefix?: string;
  /** Optional school abbreviation to include in the PID */
  schoolPrefix?: string;
  /** Separator for PID parts (default: '-') */
  separator?: string;
  /** Maximum length for prefix values (default: 10) */
  maxPrefixLength?: number;
}

/**
 * Generate a unique, human-readable assessment PID.
 *
 * Produces a CRC32 checksum of `userId` (the user's email), optionally
 * prefixed with district and school abbreviations, separated by `separator`.
 *
 * Format: `{checksum}[-{districtPrefix}][-{schoolPrefix}]`
 *
 * This is a port of `generateAssessmentPid` from the ROAR rostering utilities,
 * adapted for direct TypeScript use in the backend.
 *
 * @example No prefixes
 * ```ts
 * generateAssessmentPid({ userId: 'user@example.com' })
 * // => "a1b2c3d4"
 * ```
 *
 * @example With org prefixes
 * ```ts
 * generateAssessmentPid({ userId: 'user@example.com', districtPrefix: 'USD', schoolPrefix: 'ELEM' })
 * // => "a1b2c3d4-USD-ELEM"
 * ```
 *
 * @param options - Generation options
 * @returns Assessment PID string
 * @throws {Error} If `userId` is empty or prefixes exceed `maxPrefixLength`
 */
export function generateAssessmentPid({
  userId,
  districtPrefix,
  schoolPrefix,
  separator = '-',
  maxPrefixLength = 10,
}: AssessmentPidOptions): string {
  if (!userId || userId.trim().length === 0) {
    throw new Error('userId is required and must be a non-empty string');
  }

  if (districtPrefix !== undefined && districtPrefix.length > maxPrefixLength) {
    throw new Error(`District prefix cannot exceed ${maxPrefixLength} characters`);
  }

  if (schoolPrefix !== undefined && schoolPrefix.length > maxPrefixLength) {
    throw new Error(`School prefix cannot exceed ${maxPrefixLength} characters`);
  }

  if (separator.length === 0) {
    throw new Error('Separator must be a non-empty string');
  }

  const checksum = crc32String(userId.trim());
  const parts: string[] = [checksum];

  if (districtPrefix && districtPrefix.trim().length > 0) {
    parts.push(districtPrefix.trim());
  }

  if (schoolPrefix && schoolPrefix.trim().length > 0) {
    parts.push(schoolPrefix.trim());
  }

  return parts.join(separator);
}
