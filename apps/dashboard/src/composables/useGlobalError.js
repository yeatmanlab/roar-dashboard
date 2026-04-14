import { ref, readonly } from 'vue';

/**
 * @typedef {'rostering-ended' | 'auth-expired' | 'server-error'} GlobalErrorType
 */

/**
 * @typedef {Object} GlobalError
 * @property {GlobalErrorType} type - The type of global error
 * @property {string} [message] - Optional human-readable message
 */

/** @type {import('vue').Ref<GlobalError|null>} */
const globalError = ref(null);

/**
 * Provides access to the global error state.
 * Uses a module-scoped ref so all consumers share the same state.
 *
 * @returns {{ globalError: import('vue').DeepReadonly<import('vue').Ref<GlobalError|null>>, setGlobalError: (error: GlobalError) => void, clearGlobalError: () => void }}
 */
export function useGlobalError() {
  /**
   * Sets the global error state.
   * Type values are app-level categories, not backend error codes.
   * Conversion from backend codes happens at the catch point.
   *
   * @param {GlobalError} error
   */
  function setGlobalError(error) {
    globalError.value = error;
  }

  /** Clears the global error state. */
  function clearGlobalError() {
    globalError.value = null;
  }

  return {
    globalError: readonly(globalError),
    setGlobalError,
    clearGlobalError,
  };
}
