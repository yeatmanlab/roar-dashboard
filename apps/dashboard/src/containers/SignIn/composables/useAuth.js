import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { setUser } from '@sentry/vue';

import { isMobileBrowser } from '@/helpers';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { resolveUserClaims } from '@/helpers/resolveUserClaims';
import { APP_ROUTES } from '@/constants/routes';
import { getAuthService } from '@/services/AuthService';
import { useGlobalError } from '@/composables/useGlobalError';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';

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

  const { setGlobalError } = useGlobalError();

  /**
   * Handle a failure that happened *after* the credential check succeeded.
   *
   * The credentials were accepted, so this is never "wrong password" — showing
   * the sign-in form's invalid-credentials error (or silently resetting it)
   * would tell the user to retype a password that is already correct. Route it
   * to the global-error mechanism instead, which the router's `beforeEach`
   * guard turns into an explicit error page.
   *
   * @param {Error} error - The error thrown while bootstrapping the session.
   */
  function handleBootstrapError(error) {
    console.error('[SignIn] failed to bootstrap session after successful sign-in', error);
    spinner.value = false;

    if (isRosteringEndedError(error)) {
      setGlobalError({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
      return;
    }
    if (isTerminalAuthError(error)) {
      setGlobalError({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
      return;
    }
    setGlobalError({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
  }

  // ---------- Claims ----------
  async function getUserClaims() {
    if (authStore.uid) {
      const uidAtStart = authStore.uid;
      // Claims are derived from the backend /me response on all builds.
      const userClaims = await resolveUserClaims();
      // The user may have switched while the fetch was in flight; a stale
      // write (or Sentry setUser) would undo the listener's identity reset.
      if (authStore.uid !== uidAtStart) return;
      authStore.userClaims = userClaims;
    }
    if (authStore.roarUid) {
      setUser({ id: authStore.roarUid });
    }
  }

  // ---------- Magic link + password reset ----------
  function sendMagicLink(userEmail) {
    authStore.initiateLoginWithEmailLink({ email: userEmail }).then(() => {
      emailLinkSent.value = true;
    });
  }
  const showSuccessAlert = ref(false);
  const successEmail = ref('');

  /**
   * Forgot password:
   * - optionally accepts an identifier (e.g., the chip's email)
   * - skips request for usernames (no @)
   * - tries to send reset email if methods suggest password-based sign-in
   * - ALWAYS shows the success alert
   */
  async function handleForgotPassword(overrideIdentifier) {
    const identifier = String(overrideIdentifier ?? email.value ?? '').trim();

    try {
      const authService = getAuthService();
      // Optional pre-check (avoids EMAIL_NOT_FOUND noise)
      let methods = [];
      try {
        methods = await authService.fetchSignInMethodsForEmail(identifier);
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
        await authService.sendPasswordResetEmail(identifier);
      }
    } catch {
      // swallow errors — UX is "always success"
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
  /**
   * Sign in via SSO popup, then bootstrap the session.
   *
   * The two awaits are in separate try blocks on purpose: a rejection from
   * `signInWithPopup` means the credentials were never accepted (form error),
   * while a rejection from `getUserClaims` means they were (global error).
   * Collapsing them into one catch is what made a failed `/me` look like a
   * cancelled popup.
   *
   * @param {'google' | 'clever' | 'classlink' | 'nycps'} provider
   */
  async function signInWithPopupAndBootstrap(provider) {
    try {
      await authStore.signInWithPopup(provider);
    } catch {
      spinner.value = false;
      invalid.value = true;
      return;
    }

    try {
      await getUserClaims();
    } catch (error) {
      handleBootstrapError(error);
    }
  }

  /**
   * Generic SSO handler. Uses popup in development (except Cypress) and on
   * desktop for Google; falls back to redirect everywhere else.
   *
   * @param {'google' | 'clever' | 'classlink' | 'nycps'} provider
   */
  function authWithSSO(provider) {
    spinner.value = true;
    const usePopup =
      (process.env.NODE_ENV === 'development' && !window.Cypress) || (provider === 'google' && !isMobileBrowser());

    if (usePopup) {
      signInWithPopupAndBootstrap(provider);
    } else {
      authStore.signInWithRedirect(provider);
    }
  }

  function authWithClever() {
    authWithSSO('clever');
  }

  function authWithClassLink() {
    authWithSSO('classlink');
  }

  function authWithNYCPS() {
    authWithSSO('nycps');
  }

  function authWithGoogle() {
    authWithSSO('google');
  }

  // ---------- Email/password ----------
  /**
   * Sign in with email/password, then bootstrap the session.
   *
   * Credential errors and post-login bootstrap errors are caught separately:
   * only `logInWithEmailAndPassword` rejecting means the email or password was
   * wrong. A `getUserClaims` rejection happens after Firebase already accepted
   * the credentials, so it must not reset the form and re-prompt for a
   * password that is already correct.
   */
  async function authWithEmailPassword() {
    invalid.value = false;
    const creds = {
      email: email.value.includes('@') ? email.value : `${email.value}@roar-auth.com`,
      password: password.value,
    };

    try {
      await authStore.logInWithEmailAndPassword(creds);
    } catch {
      invalid.value = true;
      spinner.value = false;
      return;
    }

    spinner.value = true;

    try {
      await getUserClaims();
    } catch (error) {
      handleBootstrapError(error);
    }
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
