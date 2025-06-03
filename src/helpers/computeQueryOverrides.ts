import { computed, reactive, toRefs, toRaw, toValue, ComputedRef, Ref, MaybeRefOrGetter } from 'vue';
import type { UseQueryOptions, QueryKey } from '@tanstack/vue-query'; // Import relevant types

// Define a more specific type for conditions
type Condition = MaybeRefOrGetter<boolean>;

// Use a generic type for QueryOptions, assuming it at least might have 'enabled'
type QueryOptionsWithEnabled = UseQueryOptions<any, Error, any, QueryKey> & {
  enabled?: Condition;
};

// Define the return type
interface ComputeQueryOverridesResult {
  isQueryEnabled: ComputedRef<boolean>;
  options: Omit<QueryOptionsWithEnabled, 'enabled'>;
}

/**
 * Computes the isQueryEnabled value and the options with the enabled property removed.
 *
 * @param {Condition[]} conditions - An array of boolean values, refs, or getter functions for evaluation.
 * @param {QueryOptionsWithEnabled | undefined} queryOptions - The query options object.
 * @returns {ComputeQueryOverridesResult} The response object.
 */
export const computeQueryOverrides = (
  conditions: Condition[],
  queryOptions?: QueryOptionsWithEnabled,
): ComputeQueryOverridesResult => {
  // Use reactive on a plain object copy if queryOptions exist, or an empty object
  const reactiveQueryOptions = reactive(queryOptions ? { ...toRaw(queryOptions) } : {});
  const enabled = 'enabled' in reactiveQueryOptions ? toRefs(reactiveQueryOptions).enabled : undefined;

  const isQueryEnabled = computed<boolean>(() => {
    // Check if all conditions are met.
    const allConditionsMet = conditions.every((condition) => {
      // Use toValue to handle boolean, Ref<boolean>, or () => boolean
      return toValue(condition);
    });

    // Only allow the query to run if all conditions are met and the query is enabled.
    const isEnabledOption = enabled === undefined ? true : toValue(enabled);
    return allConditionsMet && isEnabledOption;
  });

  // Remove the enabled property from the query options to avoid overriding the computed value.
  // This options object will be passed to the useQuery function in the composable.
  const options: Omit<QueryOptionsWithEnabled, 'enabled'> = queryOptions ? { ...queryOptions } : {};
  delete options.enabled;

  return { isQueryEnabled, options };
};
