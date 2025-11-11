// src/containers/SignIn/composables/useSignInForm.js
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

  // derived state
  const isUsername = computed(() => email.value && !email.value.includes('@'));
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
    hideProviders.value = false;
    spinner.value = false;
  }

  // used by the Continue button
  function continueClick(emit) {
    if (!showPasswordField.value) {
      emit?.('check-providers', email.value);
    } else {
      emit?.('submit');
    }
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
