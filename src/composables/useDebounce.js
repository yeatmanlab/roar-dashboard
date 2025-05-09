import { customRef } from 'vue';

/**
 * Creates a debounced reactive ref
 *
 * @param {Ref} value - The reactive value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Ref} A debounced ref
 */
export function useDebounce(value, delay = 200) {
  return customRef((track, trigger) => {
    let timeout;
    return {
      get() {
        track();
        return value.value;
      },
      set(newValue) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          value.value = newValue;
          trigger();
        }, delay);
      },
    };
  });
}
