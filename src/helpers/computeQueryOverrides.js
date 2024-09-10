import { computed, toRefs } from 'vue';

/**
 * Computes the isQueryEnabled value and the options with the enabled property removed.
 *
 * @param {Array<boolean | (() => boolean)>} conditions - An array of boolean values or functions for evaluation.
 * @param {QueryOptions | undefined} queryOptions - The query options object.
 * @returns {{ isQueryEnabled: ComputedRef<boolean>, options: QueryOptions }} The response object.
 */
export const computeQueryOverrides = (conditions, queryOptions) => {
  const { enabled } = toRefs(queryOptions || {});

  const isQueryEnabled = computed(() => {
    // Check if the query composable was initialized with a queryOptions object.
    // const enabled = queryOptions?.enabled;

    // Check if all conditions are met.
    const allConditionsMet = conditions.every((condition) => {
      return typeof condition === 'function' ? condition() : condition;
    });

    // Only allow the query to run if all conditions are met and the query is enabled.
    return allConditionsMet && (enabled?.value === undefined ? true : enabled);
  });

  // Remove the enabled property from the query options to avoid overriding the computed value.
  // This options object will be passed to the useQuery function in the composable.
  const options = queryOptions ? { ...queryOptions } : {};
  delete options.enabled;

  return { isQueryEnabled, options };
};
