import { Ref, isRef } from 'vue';

/**
 * Checks if an array or Vue ref containing an array has any entries
 * @param arr - The array or Vue ref to check
 * @returns boolean indicating whether the array has entries
 */
export const hasArrayEntries = (arr: any[] | Ref<any[] | null | undefined> | null | undefined): boolean => {
  if (!arr) return false;
  const array = isRef(arr) ? arr.value : arr;
  return Array.isArray(array) && array.length > 0;
}; 