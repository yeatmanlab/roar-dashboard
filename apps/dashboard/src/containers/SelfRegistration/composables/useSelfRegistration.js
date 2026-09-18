import { ref } from 'vue';
import { useFamilyRegistration } from '@/containers/FamilyRegistration/composables/useFamilyRegistration';

const GENERIC_REGISTRATION_ERROR =
  'We could not create your account. Check your connection and try again. If the problem continues, contact support.';

function toUserMessage(error, t) {
  const message = error instanceof Error ? error.message : '';
  if (/email address is already in use/i.test(message)) {
    return t('pageRegister.errors.emailInUse', message);
  }
  if (/account already exists/i.test(message)) {
    return t('pageRegister.errors.accountExists', message);
  }
  return t('pageRegister.errors.generic', GENERIC_REGISTRATION_ERROR);
}

/**
 * Coordinates account creation and screen-level workflow state.
 *
 * @param {Object} [options] Injectable workflow dependencies.
 * @param {(payload: Object) => Promise<void>} [options.createAccount] Account-creation operation.
 * @returns {Object} Reactive workflow state and registration actions.
 */
export function useSelfRegistration(options = {}) {
  const registration = options.createAccount ? null : useFamilyRegistration();
  const createAccount = options.createAccount ?? registration.submit;
  const t = options.t ?? ((_key, fallback) => fallback);

  const isSubmitting = ref(false);
  const errorMessage = ref('');
  const isSuccess = ref(false);
  const verificationToken = ref('');

  function dismissStatus() {
    errorMessage.value = '';
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

    isSubmitting.value = true;
    errorMessage.value = '';
    isSuccess.value = false;
    try {
      await createAccount(payload);
      isSuccess.value = true;
      return true;
    } catch (error) {
      errorMessage.value = toUserMessage(error, t);
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
    dismissStatus,
    setVerificationToken,
  };
}

export default useSelfRegistration;
