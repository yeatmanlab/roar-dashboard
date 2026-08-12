import { computed, toValue } from 'vue';

/**
 * useScoringVersions composable
 *
 * Builds a `taskSlug -> scoringVersion` map from the `scoringVersion` parameter
 * on each task variant returned by `useTaskVariantParametersQuery`. Mirrors the
 * backend's own `extractScoringVersions` (report.service.ts): a scoringVersion
 * is always a non-negative integer in the JSON config, so a non-integer value
 * (missing param, corrupt data) is treated as "version unknown" (`null`) rather
 * than coerced.
 *
 * @param {import('vue').MaybeRefOrGetter<Array>} taskVariantParameters – Task
 *   variants with their `parameters` array, as returned by
 *   `useTaskVariantParametersQuery` (each item: `{ taskSlug, parameters: [{ name, value }] }`).
 * @returns {{ getScoringVersions: import('vue').ComputedRef<Object> }}
 */
export function useScoringVersions(taskVariantParameters) {
  const getScoringVersions = computed(() => {
    const variants = toValue(taskVariantParameters);
    if (!variants?.length) return {};

    return Object.fromEntries(
      variants.map((variant) => {
        const rawValue = variant.parameters?.find((param) => param.name === 'scoringVersion')?.value;
        const version = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        return [variant.taskSlug, Number.isInteger(version) ? version : null];
      }),
    );
  });

  return { getScoringVersions };
}
