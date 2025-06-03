import { toValue, MaybeRefOrGetter } from 'vue';

/**
 * Test if an array has entries.
 *
 * @param {MaybeRefOrGetter<any[]>} array – The array (or ref/getter) to check for entries.
 * @returns {boolean} Whether the array has entries.
 */
export const hasArrayEntries = (array: MaybeRefOrGetter<any[]>): boolean => {
  const value = toValue(array);
  return Array.isArray(value) && value.length > 0;
};
