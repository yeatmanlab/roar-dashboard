import { ref, computed } from 'vue';

export function useSignInForm() {
  const email = ref('');
  const password = ref('');
  const invalid = ref(false);
  const showPasswordField = ref(false);
  const multipleProviders = ref(false);
  const emailLinkSent = ref(false);
  const hideProviders = ref(false);
  const spinner = ref(false);
  const availableProviders = ref([]); // ['google','clever','classlink','nycps']
  const hasCheckedProviders = ref(false);
  const discoveryError = ref(false); // provider discovery failed — retryable
  const ssoError = ref(false); // starting an SSO sign-in failed — retryable
  const isUsername = computed(() => email.value !== '' && !email.value.includes('@'));
  const canContinue = computed(() => !multipleProviders.value && !emailLinkSent.value);

  function onEmailUpdate(val) {
    email.value = String(val || '').trim();
    // A failure banner from the previous address no longer applies once the
    // user edits the email — clear it instead of leaving it up until the
    // next Continue.
    discoveryError.value = false;
    ssoError.value = false;
  }
  function onPasswordUpdate(val) {
    password.value = String(val || '');
  }

  function resetSignInUI() {
    email.value = '';
    password.value = '';
    invalid.value = false;
    showPasswordField.value = false;
    multipleProviders.value = false;
    emailLinkSent.value = false;
    hideProviders.value = false;
    spinner.value = false;
    availableProviders.value = [];
    hasCheckedProviders.value = false;
    discoveryError.value = false;
    ssoError.value = false;
  }

  function continueClick(emit) {
    if (!showPasswordField.value) emit?.('check-providers', email.value);
    else emit?.('submit');
  }

  return {
    email,
    password,
    invalid,
    showPasswordField,
    multipleProviders,
    emailLinkSent,
    hideProviders,
    spinner,
    availableProviders,
    hasCheckedProviders,
    discoveryError,
    ssoError,
    isUsername,
    canContinue,
    onEmailUpdate,
    onPasswordUpdate,
    resetSignInUI,
    continueClick,
  };
}
