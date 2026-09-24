import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { setUser } from '@sentry/vue';

import { isMobileBrowser } from '@/helpers';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { resolveUserClaims } from '@/helpers/resolveUserClaims';
import { APP_ROUTES } from '@/constants/routes';
import { getAuthService } from '@/services/AuthService';

export function useAuth(context) {
  const {
    authStore,
    router,
    route,
    email,
    password,
    invalid,
    ssoError,
    emailLinkSent,
    showPasswordField,
    resetSignInUI,
  } = context;

  // pull reactive store refs (spinner, ssoProvider)
  const { spinner, ssoProvider } = storeToRefs(authStore);

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

  /**
   * Handle a failure that happened *after* the credential check succeeded.
   *
   * The credentials were accepted, so this is never "wrong password" — showing
   * the sign-in form's invalid-credentials error (or silently resetting it)
   * would tell the user to retype a password that is already correct.
   *
   * The global error is already set by the time this runs: the bootstrap goes
   * through `resolveUserClaims`, which fetches `ME_QUERY_KEY` on the shared
   * query client, so the `QueryCache.onError` bridge in `queryClient.js` has
   * classified the failure and set `globalError` before the rejection surfaces
   * here. That bridge is documented as the single mapping from API errors to
   * `useGlobalError`; re-deriving it here would be a second surface competing
   * to set the same flag. This only stops the spinner and logs.
   *
   * @param {Error} error - The error thrown while bootstrapping the session.
   */
  function handleBootstrapError(error) {
    // `warn`, not `error`: Sentry captures console.error (levels: ['error']
    // in sentry.js), and the QueryCache bridge already logged this failure at
    // error level with the sanitized query key — a second console.error here
    // produced two Sentry events for one root cause. This line only keeps the
    // sign-in-flow context visible in the local console.
    console.warn('[Auth] failed to bootstrap session after successful sign-in', error);
    spinner.value = false;
  }

  /**
   * Resolve the session after a successful credential check, always clearing
   * the spinner. `getUserClaims` can return without throwing and without
   * signing the user in — it no-ops when the uid is absent, and bails on a
   * stale write if the identity changed mid-flight. The spinner lives on the
   * auth store and is rendered app-wide by App.vue, so leaving it set would
   * overlay whatever the redirect lands on, not just this form.
   */
  async function bootstrapSessionAfterSignIn() {
    try {
      await getUserClaims();
    } catch (error) {
      handleBootstrapError(error);
    } finally {
      spinner.value = false;
    }
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
   * `signInWithPopup` means the provider flow failed (SSO error banner),
   * while a rejection from `getUserClaims` means sign-in succeeded and the
   * bootstrap failed (global error). Collapsing them into one catch is what
   * made a failed `/me` look like a cancelled popup.
   *
   * @param {'google' | 'clever' | 'classlink' | 'nycps'} provider
   */
  async function signInWithPopupAndBootstrap(provider) {
    try {
      await authStore.signInWithPopup(provider);
    } catch {
      spinner.value = false;
      // `ssoError`, not `invalid`: the user never typed a password, so
      // "incorrect email or password" would misdirect them into resets.
      ssoError.value = true;
      return;
    }

    await bootstrapSessionAfterSignIn();
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
      // A rejection before the browser leaves the page (e.g. initialization
      // failure) would otherwise die silently with the spinner stuck on.
      authStore.signInWithRedirect(provider).catch(() => {
        spinner.value = false;
        ssoError.value = true;
      });
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

    await bootstrapSessionAfterSignIn();
  }

  return {
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
