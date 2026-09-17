import { UUID_REGEX } from '../constants/regex';

/**
 * Validates that a string is a valid UUID.
 */
export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}
