/**
 * Adapt flat task-bundle list items (from `useTaskBundlesQuery` /
 * `GET /task-bundles`) into the nested `{ id, data: { ... } }` shape the
 * administration-form task picker (`TaskPicker` / `TaskBundleCard`) consumes.
 *
 * This is a transitional compatibility layer: it lets the administration form
 * read task bundles from the backend API without rewriting the picker
 * components, which still expect the legacy Firestore-era bundle shape.
 *
 * Field mapping (flat → nested):
 * - `id` → `id` (kept at the top level; the picker also reads `bundle.id`)
 * - `name` → `data.name`
 * - `name` → `data.publicName` — the backend bundle schema has no `publicName`;
 *   the picker's search filter reads `bundle.data.publicName`, so we fall back to
 *   `name`. Remove this fallback once the picker no longer searches `publicName`.
 * - `image` → `data.image`
 * - `taskVariants[]` → `data.variants[]` as `{ taskId, variantId }`:
 *     - `variantId` ← `taskVariants[].taskVariantId` (the backend variant id) so it
 *       matches the `id` of the nested variant objects produced by
 *       `adaptVariantsForPicker` (whose `id` is also `taskVariantId`).
 *     - `taskId` ← `taskVariants[].taskId` (the backend task id, present only when
 *       the query requests `?embed=taskVariantDetails`) so it matches the key the
 *       picker groups the variant catalog by (`_groupBy(allVariants, 'task.id')`).
 *   The picker expands a bundle by looking up `allVariants[taskId]` and finding the
 *   entry whose `id === variantId`, so both ids must come from the backend variant
 *   id space — which is exactly what these refer to.
 *
 * @param {Array<object>} [bundles] - Flat task-bundle items from the API.
 * @returns {Array<object>} A flat array of nested bundle objects, preserving input order.
 */
export function adaptBundlesForPicker(bundles = []) {
  return (bundles ?? []).map((bundle) => ({
    id: bundle.id,
    data: {
      name: bundle.name,
      // Backend bundles have no publicName; the picker searches this field, so fall back to name.
      publicName: bundle.name,
      image: bundle.image,
      variants: (bundle.taskVariants ?? []).map((variant) => ({
        taskId: variant.taskId,
        variantId: variant.taskVariantId,
      })),
    },
  }));
}

export default adaptBundlesForPicker;
