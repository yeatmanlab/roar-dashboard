import { storeToRefs } from 'pinia';
import { toRaw, computed } from 'vue';
import { setUser } from '@sentry/vue';

import { isMobileBrowser } from '@/helpers';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { fetchDocById } from '@/helpers/query/utils';
import { APP_ROUTES } from '@/constants/routes';

/**
 * @param {{
 *   authStore: ReturnType<typeof import('@/store/auth').useAuthStore>,
 *   router: import('vue-router').Router,
 *   route: import('vue-router').RouteLocationNormalizedLoaded,
 *
 *   // refs from useSignInForm
 *   email: import('vue').Ref<string>,
 *   password: import('vue').Ref<string>,
 *   invalid: import('vue').Ref<boolean>,
 *   emailLinkSent: import('vue').Ref<boolean>,
 *   showPasswordField: import('vue').Ref<boolean>,
 * }} context
 */
export function useAuth(context) {
  const { authStore, router, route, email, password, invalid, emailLinkSent, showPasswordField } = context;

  // pull reactive store refs (spinner, ssoProvider, roarfirekit)
  const { spinner, ssoProvider, roarfirekit } = storeToRefs(authStore);

  // ✅ Derived UI decisions moved here
  const isUsername = computed(() => {
    const v = email.value ?? '';
    return v !== '' && !String(v).includes('@');
  });
  // Keep Google hidden on first screen (as before)
  const showGenericProviders = computed(() => false);
  // Show district (Clever/ClassLink/NYCPS) on first screen
  const showScopedProviders = computed(() => !showPasswordField.value && !emailLinkSent.value);

  /* ---------- Post-login redirect wiring ---------- */
  // This mirrors your old page behavior
  authStore.$subscribe(() => {
    if (authStore.uid) {
      if (ssoProvider.value) {
        router.push({ path: APP_ROUTES.SSO });
      } else {
        router.push({ path: redirectSignInPath(route) });
      }
    }
  });

  /* ---------- Claims ---------- */
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

  /* ---------- Magic link + password reset ---------- */
  function sendMagicLink(userEmail) {
    authStore.initiateLoginWithEmailLink({ email: userEmail }).then(() => {
      emailLinkSent.value = true;
    });
  }
  function handleForgotPassword() {
    roarfirekit.value?.sendPasswordResetEmail(email.value);
  }
  function handleBackToPassword() {
    emailLinkSent.value = false;
    showPasswordField.value = true;
  }

  /* ---------- SSO flows ---------- */
  function authWithClever() {
    if (process.env.NODE_ENV === 'development' && !window.Cypress) {
      spinner.value = true;
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
    authStore.signInWithClassLinkRedirect();
  }

  function authWithNYCPS() {
    if (process.env.NODE_ENV === 'development' && !window.Cypress) {
      spinner.value = true;
      authStore
        .signInWithNYCPSPopup()
        .then(getUserClaims)
        .catch(() => (spinner.value = false));
    } else {
      spinner.value = true;
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

  /* ---------- Email/password ---------- */
  function authWithEmailPassword() {
    invalid.value = false;
    const creds = toRaw({
      email: email.value.includes('@') ? email.value : `${email.value}@roar-auth.com`,
      password: password.value,
    });
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

    // claims (exposed in case you need it)
    getUserClaims,
  };
}
