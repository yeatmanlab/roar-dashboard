import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { setUser } from '@sentry/vue';

import { isMobileBrowser } from '@/helpers';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { fetchDocById } from '@/helpers/query/utils';
import { APP_ROUTES } from '@/constants/routes';

export function useAuth(context) {
  const { authStore, router, route, email, password, invalid, emailLinkSent, showPasswordField, resetSignInUI } =
    context;

  // pull reactive store refs (spinner, ssoProvider, roarfirekit)
  const { spinner, ssoProvider, roarfirekit } = storeToRefs(authStore);

  const isUsername = computed(() => {
    const v = email.value ?? '';
    return v !== '' && !String(v).includes('@');
  });
  const showGenericProviders = computed(() => false);
  const showScopedProviders = computed(() => !showPasswordField.value && !emailLinkSent.value);

  // ---------- Post-login redirect wiring ----------
  authStore.$subscribe(() => {
    if (authStore.uid) {
      if (ssoProvider.value) {
        router.push({ path: APP_ROUTES.SSO });
      } else {
        router.push({ path: redirectSignInPath(route) });
      }
    }
  });

  // ---------- Claims ----------
  async function getUserClaims() {
    if (authStore.uid) {
      const userClaims = await fetchDocById('userClaims', authStore.uid);
      authStore.userClaims = userClaims;
    }
    if (authStore.roarUid) {
      const userData = await fetchDocById('users', authStore.roarUid);
      authStore.userData = userData;
      setUser({ id: authStore.roarUid, userType: userData?.userType });
    }
  }

  // ---------- Magic link + password reset ----------
  function sendMagicLink(userEmail) {
    authStore.initiateLoginWithEmailLink({ email: userEmail }).then(() => {
      emailLinkSent.value = true;
    });
  }
  // ✅ Password reset “always-success” alert
  const showSuccessAlert = ref(false);
  const successEmail = ref('');

  /**
   * Forgot password:
   * - optionally accepts an identifier (e.g., the chip’s email)
   * - skips request for usernames (no @)
   * - tries to send reset email if methods suggest password-based sign-in
   * - ALWAYS shows the success alert
   */
  async function handleForgotPassword(overrideIdentifier) {
    const identifier = String(overrideIdentifier ?? email.value ?? '').trim();

    try {
      // Optional pre-check (avoids EMAIL_NOT_FOUND noise)
      let methods = [];
      try {
        methods = await roarfirekit.value?.fetchEmailAuthMethods(identifier);
      } catch {
        /* ignore */
      }

      const hasPasswordish =
        Array.isArray(methods) &&
        methods.some((m) => {
          const s = String(m).toLowerCase();
          return s === 'password' || s === 'email' || s === 'emaillink';
        });

      if (hasPasswordish) {
        await roarfirekit.value.sendPasswordResetEmail(identifier);
      }
    } catch {
      // swallow errors — UX is “always success”
    } finally {
      successEmail.value = identifier;
      showSuccessAlert.value = true;
      setTimeout(() => {
        showSuccessAlert.value = false;
        resetSignInUI();
      }, 5000);
    }
  }

  function handleBackToPassword() {
    emailLinkSent.value = false;
    showPasswordField.value = true;
  }

  // ---------- SSO flows ----------
  function authWithClever() {
    spinner.value = true;
    if (process.env.NODE_ENV === 'development' && !window.Cypress) {
      authStore
        .signInWithCleverPopup()
        .then(getUserClaims)
        .catch(() => (spinner.value = false));
    } else {
      spinner.value = true;
      authStore.signInWithCleverRedirect();
    }
  }

  function authWithClassLink() {
    spinner.value = true;
    if (process.env.NODE_ENV === 'development' && !window.Cypress) {
      authStore
        .signInWithClassLinkPopup()
        .then(getUserClaims)
        .catch(() => (spinner.value = false));
    } else {
      authStore.signInWithClassLinkRedirect();
    }
  }

  function authWithNYCPS() {
    spinner.value = true;
    if (process.env.NODE_ENV === 'development' && !window.Cypress) {
      authStore
        .signInWithNYCPSPopup()
        .then(getUserClaims)
        .catch(() => (spinner.value = false));
    } else {
      authStore.signInWithNYCPSRedirect();
    }
  }

  function authWithGoogle() {
    spinner.value = true;
    if (isMobileBrowser()) {
      authStore.signInWithGoogleRedirect();
      return;
    }
    authStore
      .signInWithGooglePopup()
      .then(getUserClaims)
      .catch(() => {
        spinner.value = false;
        invalid.value = true;
      });
  }

  // ---------- Email/password ----------
  function authWithEmailPassword() {
    invalid.value = false;
    const creds = {
      email: email.value.includes('@') ? email.value : `${email.value}@roar-auth.com`,
      password: password.value,
    };
    authStore
      .logInWithEmailAndPassword(creds)
      .then(async () => {
        spinner.value = true;
        await getUserClaims();
      })
      .catch(() => {
        invalid.value = true;
        spinner.value = false;
      });
  }

  return {
    roarfirekit,
    spinner,

    isUsername,
    showGenericProviders,
    showScopedProviders,

    // auth flows
    authWithGoogle,
    authWithClever,
    authWithClassLink,
    authWithNYCPS,
    authWithEmailPassword,

    // email link / forgot password / back
    sendMagicLink,
    handleForgotPassword,
    handleBackToPassword,
    showSuccessAlert,
    successEmail,

    // claims (exposed in case you need it)
    getUserClaims,
  };
}
