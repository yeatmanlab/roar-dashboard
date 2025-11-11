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
  const forgotPasswordOpen = ref(false);
  const forgotEmail = ref('');
  const isUsername = computed(() => email.value !== '' && !email.value.includes('@'));
  const canContinue = computed(() => !multipleProviders.value && !emailLinkSent.value);

  function onEmailUpdate(val) {
    email.value = String(val || '').trim();
  }
  function onPasswordUpdate(val) {
    password.value = String(val || '');
  }
  function openForgotPasswordModal() {
    // pre-fill with whatever is in the email field
    forgotEmail.value = email.value || '';
    forgotPasswordOpen.value = true;
  }
  function closeForgotPasswordModal() {
    forgotPasswordOpen.value = false;
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
    forgotPasswordOpen.value = false;
    forgotEmail.value = '';
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
    forgotPasswordOpen,
    forgotEmail,
    isUsername,
    canContinue,
    onEmailUpdate,
    onPasswordUpdate,
    resetSignInUI,
    continueClick,
    openForgotPasswordModal,
    closeForgotPasswordModal,
  };
}
