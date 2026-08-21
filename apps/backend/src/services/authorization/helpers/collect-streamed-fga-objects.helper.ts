/**
 * Collect an async generator of FGA streamed-list-objects responses into an
 * array of fully-qualified object strings.
 *
 * Pairs with `AuthorizationService.listAccessibleObjectsStreamed`, which
 * yields chunks shaped like the FGA SDK's `StreamedListObjectsResponse`
 * (`{ object: string }`). Use this helper when the caller needs a single
 * materialized list of object IDs (e.g., for a low-cardinality consumer that
 * wants the convenience of `string[]`). For very high-cardinality cases
 * prefer iterating the generator directly so the full list never lives in
 * memory at once.
 *
 * ## Why this lives in `services/authorization/helpers/`
 *
 * The function is FGA-domain-specific (its input shape is the SDK's stream
 * response) but layer-neutral — it doesn't touch the database. Co-locating
 * it with the other FGA helpers (`extract-fga-object-id.helper.ts`) keeps
 * services from importing across the service/repository layer boundary just
 * to drain a stream.
 *
 * @param generator - Generator yielding `{ object: string }` chunks (the SDK's
 *                    `StreamedListObjectsResponse` shape)
 * @returns Promise resolving to an array of fully-qualified FGA object strings
 *          (e.g., `['administration:abc-123', 'administration:def-456']`)
 *
 * @example
 * ```typescript
 * const ids = await collectStreamedFgaObjects(
 *   authorizationService.listAccessibleObjectsStreamed(userId, FgaRelation.CAN_READ, FgaType.CLASS),
 * );
 * ```
 */
export async function collectStreamedFgaObjects(generator: AsyncIterable<{ object: string }>): Promise<string[]> {
  const objects: string[] = [];
  for await (const chunk of generator) {
    objects.push(chunk.object);
  }
  return objects;
}
