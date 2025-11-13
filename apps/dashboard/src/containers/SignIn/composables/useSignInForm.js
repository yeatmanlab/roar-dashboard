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
  const isUsername = computed(() => email.value !== '' && !email.value.includes('@'));
  const canContinue = computed(() => !multipleProviders.value && !emailLinkSent.value);

  function onEmailUpdate(val) {
    email.value = String(val || '').trim();
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
    isUsername,
    canContinue,
    onEmailUpdate,
    onPasswordUpdate,
    resetSignInUI,
    continueClick,
  };
}
