import { computed, onScopeDispose, ref } from 'vue';
import { useFamilyRegistration } from '@/containers/FamilyRegistration/composables/useFamilyRegistration';
import { ACCOUNT_CREATION_ERROR_MESSAGE } from '@/constants/auth';

/**
 * Coordinates account creation and screen-level workflow state.
 *
 * @param {Object} [options] Injectable workflow dependencies.
 * @param {Object} [options.registration] Family-registration workflow.
 * @param {(payload: Object) => Promise<void>} options.registration.submit Account-creation operation.
 * @param {import('vue').Ref<boolean>} options.registration.isSubmitting Registration loading state.
 * @param {import('vue').Ref<Error|null>} options.registration.error Registration failure state.
 * @param {Function} [options.redirect] Post-registration navigation operation.
 * @param {number} [options.redirectDelay] Delay before post-registration navigation.
 * @returns {Object} Reactive workflow state and registration actions.
 */
export function useSelfRegistration({
  registration = useFamilyRegistration(),
  redirect = () => window.location.assign('/'),
  redirectDelay = 1500,
} = {}) {
  const { isSubmitting, error } = registration;
  const errorMessage = computed(() => (error.value ? ACCOUNT_CREATION_ERROR_MESSAGE : ''));
  const isSuccess = ref(false);
  const verificationToken = ref('');
  let redirectTimeout;

  function cancelRedirect() {
    if (redirectTimeout !== undefined) {
      clearTimeout(redirectTimeout);
      redirectTimeout = undefined;
    }
  }

  function dismissStatus() {
    cancelRedirect();
    error.value = null;
    isSuccess.value = false;
  }

  function setVerificationToken(token) {
    // TODO(#2186): Send this token to server-side verification when the
    // POST /v1/families contract accepts anti-abuse evidence. The current API
    // shape cannot verify a token and changing it spans dashboard, contract,
    // and backend review.
    verificationToken.value = token ?? '';
  }

  async function submit(payload) {
    if (isSubmitting.value) return false;

    error.value = null;
    isSuccess.value = false;
    try {
      await registration.submit(payload);
      isSuccess.value = true;
      redirectTimeout = setTimeout(redirect, redirectDelay);
      return true;
    } catch (caughtError) {
      error.value = error.value ?? (caughtError instanceof Error ? caughtError : new Error(String(caughtError)));
      return false;
    }
  }

  onScopeDispose(cancelRedirect);

  return {
    isSubmitting,
    errorMessage,
    isSuccess,
    verificationToken,
    submit,
    dismissStatus,
    cancelRedirect,
    setVerificationToken,
  };
}

export default useSelfRegistration;
