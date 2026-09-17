import { computed } from 'vue';
import { isRosteringEndedError, isTerminalAuthError, getApiErrorCode, getApiErrorMessage } from '@/utils/api-errors';

/**
 * Wraps API error utilities with Vue reactivity.
 * Accepts a ref or computed that holds the current error.
 *
 * @param {import('vue').Ref<Object|null>} errorRef - Reactive reference to the error
 * @returns {{ isRosteringEnded: import('vue').ComputedRef<boolean>, isTerminalAuth: import('vue').ComputedRef<boolean>, errorCode: import('vue').ComputedRef<string|null>, errorMessage: import('vue').ComputedRef<string|null> }}
 */
export function useRoarApiError(errorRef) {
  const isRosteringEnded = computed(() => {
    return errorRef.value ? isRosteringEndedError(errorRef.value) : false;
  });

  const isTerminalAuth = computed(() => {
    return errorRef.value ? isTerminalAuthError(errorRef.value) : false;
  });

  const errorCode = computed(() => {
    return errorRef.value ? getApiErrorCode(errorRef.value) : null;
  });

  const errorMessage = computed(() => {
    return errorRef.value ? getApiErrorMessage(errorRef.value) : null;
  });

  return {
    isRosteringEnded,
    isTerminalAuth,
    errorCode,
    errorMessage,
  };
}
