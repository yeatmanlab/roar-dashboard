import { onScopeDispose, ref } from 'vue';
import { useFamilyRegistration } from '@/containers/FamilyRegistration/composables/useFamilyRegistration';

const GENERIC_REGISTRATION_ERROR =
  'We could not create your account. Check your connection and try again. If the problem continues, contact support.';

function toUserMessage(error) {
  const message = error instanceof Error ? error.message : '';
  if (/already (?:in use|exists)/i.test(message)) return message;
  return GENERIC_REGISTRATION_ERROR;
}

/** Coordinates account creation and screen-level workflow state. */
export function useSelfRegistration(options = {}) {
  const registration = options.createAccount ? null : useFamilyRegistration();
  const createAccount = options.createAccount ?? registration.submit;
  const redirect = options.redirect ?? (() => window.location.assign('/'));
  const redirectDelay = options.redirectDelay ?? 1500;

  const isSubmitting = ref(false);
  const errorMessage = ref('');
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
    errorMessage.value = '';
    isSuccess.value = false;
  }

  function setVerificationToken(token) {
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
      redirectTimeout = setTimeout(redirect, redirectDelay);
      return true;
    } catch (error) {
      errorMessage.value = toUserMessage(error);
      return false;
    } finally {
      isSubmitting.value = false;
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
