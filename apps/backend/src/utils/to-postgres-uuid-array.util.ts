import { isValidUuid } from './is-valid-uuid.util';

/**
 * Converts an array of UUIDs to a PostgreSQL array literal.
 * Validates each UUID to prevent SQL injection.
 *
 * @param ids - Array of UUID strings
 * @returns PostgreSQL array literal format: {uuid1,uuid2,...}
 * @throws Error if any ID is not a valid UUID
 */
export function toPostgresUuidArray(ids: string[]): string {
  for (const id of ids) {
    if (!isValidUuid(id)) {
      throw new Error(`Invalid UUID format: ${id}`);
    }
  }
  return `{${ids.join(',')}}`;
}
