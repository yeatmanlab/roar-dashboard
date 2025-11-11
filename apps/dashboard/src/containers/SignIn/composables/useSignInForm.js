import { ref, computed } from 'vue';

export function useSignInForm() {
  // ----- reactive state -----
  const email = ref('');
  const password = ref('');
  const invalid = ref(false);
  const showPasswordField = ref(false);
  const multipleProviders = ref(false);
  const emailLinkSent = ref(false);
  const hideProviders = ref(false);
  const spinner = ref(false);

  // provider discovery state (needed by useProviders)
  const availableProviders = ref([]); // ['google','clever','classlink','nycps','password']
  const hasCheckedProviders = ref(false);

  // ----- derived -----
  const isUsername = computed(() => email.value !== '' && !email.value.includes('@'));
  const canContinue = computed(() => !multipleProviders.value && !emailLinkSent.value);

  // ----- actions -----
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

    // keep district providers visible on first screen (your current behavior)
    hideProviders.value = false;

    spinner.value = false;

    // reset discovery
    availableProviders.value = [];
    hasCheckedProviders.value = false;
  }

  // used by the Continue button (if you ever need it in the container)
  function continueClick(emit) {
    if (!showPasswordField.value) emit?.('check-providers', email.value);
    else emit?.('submit');
  }

  return {
    // state
    email,
    password,
    invalid,
    showPasswordField,
    multipleProviders,
    emailLinkSent,
    hideProviders,
    spinner,

    // provider discovery state (← required for auto-continue)
    availableProviders,
    hasCheckedProviders,

    // derived
    isUsername,
    canContinue,

    // actions
    onEmailUpdate,
    onPasswordUpdate,
    resetSignInUI,
    continueClick,
  };
}
