/**
 * Extract the raw ID from a fully qualified FGA object string.
 *
 * FGA objects use the format `type:id` (e.g., `administration:abc-123`).
 * This utility strips the type prefix and returns just the ID.
 *
 * @param fgaObject - Fully qualified FGA object (e.g., `administration:abc-123`)
 * @returns The ID portion after the colon (e.g., `abc-123`)
 *
 * @example
 * ```ts
 * extractFgaObjectId('administration:abc-123') // 'abc-123'
 * ```
 */
export function extractFgaObjectId(fgaObject: string): string {
  return fgaObject.split(':')[1] ?? '';
}
