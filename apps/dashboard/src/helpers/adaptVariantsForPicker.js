/**
 * Adapt flat task-variant list items (from `useTaskVariantsListQuery` /
 * `GET /task-variants`) into the nested `{ id, variant, task }` shape the
 * administration-form variant picker (`TaskPicker` / `VariantCard` /
 * `EditVariantDialog`) consumes.
 *
 * This is a transitional compatibility layer: it lets the administration form
 * read variants from the backend API without rewriting the picker components.
 * Those components will be migrated to consume the flat shape directly in a
 * later, dedicated effort (tracked separately).
 *
 * Field mapping (flat → nested):
 * - `parameters` (array of `{ name, value }`) → `variant.params` (object)
 * - `name` → `variant.name`
 * - `taskName` / `taskImage` / `taskSlug` → `task.name` / `task.image` / `task.slug`
 * - `task.studentFacingName` falls back to `taskName` (no flat equivalent; the
 *   picker searches this field)
 * - per-assignment `variant.conditions` is intentionally omitted — it is set by
 *   the form / `EditVariantDialog` when a variant is configured for the administration.
 *
 * @param {Array<object>} [flatVariants] - Flat task-variant items from the API.
 * @returns {Array<object>} Nested variant objects for the picker.
 */
export function adaptVariantsForPicker(flatVariants = []) {
  return (flatVariants ?? []).map((item) => ({
    id: item.id,
    variant: {
      id: item.id,
      name: item.name,
      params: Object.fromEntries((item.parameters ?? []).map(({ name, value }) => [name, value])),
    },
    task: {
      id: item.taskId,
      name: item.taskName,
      studentFacingName: item.taskName,
      image: item.taskImage,
      slug: item.taskSlug,
    },
  }));
}

export default adaptVariantsForPicker;
