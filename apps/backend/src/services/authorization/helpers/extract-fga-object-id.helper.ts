/**
 * Extracts the raw ID from an FGA object string.
 *
 * FGA objects are formatted as `type:id` (e.g., `administration:abc-123`).
 * This helper returns just the ID portion.
 *
 * @param fgaObject - The fully-qualified FGA object string
 * @returns The ID portion after the colon, or empty string if malformed
 */
export function extractFgaObjectId(fgaObject: string): string {
  return fgaObject.split(':')[1] ?? '';
}
