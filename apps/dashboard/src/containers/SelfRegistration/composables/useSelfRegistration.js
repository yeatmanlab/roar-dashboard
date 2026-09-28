import { computed, ref } from 'vue';
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
 * @returns {Object} Reactive workflow state and registration actions.
 */
export function useSelfRegistration({
  registration = useFamilyRegistration(),
  redirect = () => window.location.assign('/'),
} = {}) {
  const { isSubmitting, error } = registration;
  const errorMessage = computed(() => (error.value ? ACCOUNT_CREATION_ERROR_MESSAGE : ''));
  const verificationToken = ref('');

  function dismissError() {
    error.value = null;
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
    try {
      await registration.submit(payload);
      redirect();
      return true;
    } catch (caughtError) {
      error.value = error.value ?? (caughtError instanceof Error ? caughtError : new Error(String(caughtError)));
      return false;
    }
  }

  return {
    isSubmitting,
    errorMessage,
    verificationToken,
    submit,
    dismissError,
    setVerificationToken,
  };
}

export default useSelfRegistration;
