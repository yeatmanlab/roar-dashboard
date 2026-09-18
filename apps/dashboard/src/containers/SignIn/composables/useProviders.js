import { toValue } from 'vue';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';
import { getAuthService } from '@/services/AuthService';

export function useProviders(options) {
  const {
    email,
    isUsername,
    availableProviders,
    hasCheckedProviders,
    multipleProviders,
    hideProviders,
    showPasswordField,
    discoveryError,
    authWithGoogle,
    authWithClever,
    authWithClassLink,
    authWithNYCPS,

    invalid,
  } = options;

  /** Normalize Firebase/AuthKit provider ids to our internal names */
  async function normalizeProviders(ids = []) {
    const out = new Set();
    for (const id of ids) {
      const lower = String(id).toLowerCase();

      if (lower === 'password' || lower === 'emaillink') out.add('password');

      if (lower === 'google.com' || lower === AUTH_SSO_PROVIDERS.GOOGLE) out.add(AUTH_SSO_PROVIDERS.GOOGLE);
      if (lower.includes('clever')) out.add(AUTH_SSO_PROVIDERS.CLEVER);
      if (lower.includes('classlink')) out.add(AUTH_SSO_PROVIDERS.CLASSLINK);
      if (lower.includes('nycps')) out.add(AUTH_SSO_PROVIDERS.NYCPS);
    }
    return [...out];
  }

  async function getProviders() {
    const emailVal = (toValue(email) || '').trim().toLowerCase();
    // Constraint: fetchSignInMethodsForEmail returns [] for every address once
    // Firebase email-enumeration protection is enabled on the project. The
    // setting is currently off (verified 2026-09-17), but enabling it is
    // planned. TODO: move discovery to a backend endpoint before the setting
    // is turned on, or every user degrades to the password form.
    const raw = await getAuthService().fetchSignInMethodsForEmail(emailVal);
    const norm = await normalizeProviders(raw || []);
    availableProviders.value = norm;
    hasCheckedProviders.value = true;
    return norm;
  }

  /**
   * Main entry: called when user hits Continue / Enter on the identifier step
   * - Decides which screen to show next
   * - Auto-continues on single SSO
   */
  async function checkAvailableProviders(triggeredEmail) {
    // ensure email is set
    if (typeof triggeredEmail === 'string') {
      email.value = triggeredEmail.trim();
    }

    discoveryError.value = false;

    // username path → direct password flow
    if (toValue(isUsername)) {
      showPasswordField.value = true;
      availableProviders.value = ['password'];
      hideProviders.value = true; // no providers row on password view
      hasCheckedProviders.value = true;
      return;
    }

    // getProviders sets availableProviders and hasCheckedProviders itself.
    let providers;
    try {
      providers = await getProviders();
    } catch {
      // Discovery failed — surface a retryable error instead of degrading to
      // the password form, which cannot work for SSO-only users.
      discoveryError.value = true;
      return;
    }

    // multi SSO chooser
    const sso = providers.filter((p) =>
      [
        AUTH_SSO_PROVIDERS.GOOGLE,
        AUTH_SSO_PROVIDERS.CLEVER,
        AUTH_SSO_PROVIDERS.CLASSLINK,
        AUTH_SSO_PROVIDERS.NYCPS,
      ].includes(p),
    );

    multipleProviders.value = sso.length > 1;

    if (multipleProviders.value) {
      hideProviders.value = false; // show chooser
      showPasswordField.value = false; // stay on non-password view
      if (invalid?.value) invalid.value = false; // clear lingering red error if any
      return;
    }

    // single SSO → auto continue
    if (providers.includes(AUTH_SSO_PROVIDERS.GOOGLE)) return authWithGoogle?.();
    if (providers.includes(AUTH_SSO_PROVIDERS.CLEVER)) return authWithClever?.();
    if (providers.includes(AUTH_SSO_PROVIDERS.CLASSLINK)) return authWithClassLink?.();
    if (providers.includes(AUTH_SSO_PROVIDERS.NYCPS)) return authWithNYCPS?.();

    // fallback → password / magic link
    showPasswordField.value = providers.includes('password') || providers.length === 0;
    hideProviders.value = true;
  }

  return {
    normalizeProviders,
    getProviders,
    checkAvailableProviders,
  };
}
