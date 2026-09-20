import { computed, ref } from 'vue';
import useCreateFamilyMutation from '@/composables/mutations/useCreateFamilyMutation';
import { ACCOUNT_CREATION_ERROR_MESSAGE } from '@/constants/auth';
import { mapParentFormToCreateFamily } from '@/helpers/registration/mapParentFormToCreateFamily';

/**
 * Coordinates account creation and screen-level workflow state.
 *
 * @param {Object} [options] Injectable workflow dependencies.
 * @param {(payload: Object) => Promise<unknown>} [options.createAccount] Account-creation operation.
 * @param {Function} [options.t] Translation function for user-facing errors.
 * @returns {Object} Reactive workflow state and registration actions.
 */
export function useSelfRegistration({ createAccount, t = (_key, fallback) => fallback } = {}) {
  const createFamilyMutation = createAccount ? null : useCreateFamilyMutation();
  const submitAccount =
    createAccount ?? ((payload) => createFamilyMutation.mutateAsync({ body: mapParentFormToCreateFamily(payload) }));

  const isSubmitting = ref(false);
  const error = ref(null);
  const errorMessage = computed(() =>
    error.value ? t('pageRegister.errors.generic', ACCOUNT_CREATION_ERROR_MESSAGE) : '',
  );
  const isSuccess = ref(false);
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

    isSubmitting.value = true;
    error.value = null;
    isSuccess.value = false;

    try {
      await submitAccount(payload);
      isSuccess.value = true;
      return true;
    } catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    isSubmitting,
    errorMessage,
    isSuccess,
    verificationToken,
    submit,
    dismissError,
    setVerificationToken,
  };
}

export default useSelfRegistration;
