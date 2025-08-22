import { toValue } from 'vue';

/**
 * Test if an array has entries.
 *
 * @param {Array} array – The array to check for entries.
 * @returns {boolean} Whether the array has entries.
 */
export const hasArrayEntries = (array) => {
  return Array.isArray(toValue(array)) && toValue(array).length > 0;
};
