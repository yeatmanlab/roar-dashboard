import { toValue } from 'vue';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';

export function useProviders(options) {
  const {
    email,
    isUsername,
    availableProviders,
    hasCheckedProviders,
    multipleProviders,
    hideProviders,
    showPasswordField,
    roarfirekit,
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
      if (lower.startsWith('oidc.') && lower.includes('clever')) out.add(AUTH_SSO_PROVIDERS.CLEVER);
      if (lower.startsWith('oidc.') && lower.includes('classlink')) out.add(AUTH_SSO_PROVIDERS.CLASSLINK);
      if (lower.startsWith('oidc.') && lower.includes('nycps')) out.add(AUTH_SSO_PROVIDERS.NYCPS);
    }
    return [...out];
  }

  async function getProviders() {
    const kit = toValue(roarfirekit);
    if (!kit) {
      availableProviders.value = [];
      hasCheckedProviders.value = true;
      return [];
    }
    const emailVal = (toValue(email) || '').trim().toLowerCase();
    const raw = await kit.fetchEmailAuthMethods(emailVal);
    const norm = normalizeProviders(raw || []);
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

    // username path → direct password flow
    if (toValue(isUsername)) {
      showPasswordField.value = true;
      availableProviders.value = ['password'];
      hideProviders.value = true; // no providers row on password view
      hasCheckedProviders.value = true;
      return;
    }

    const providers = await getProviders();

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
      if (invalid) invalid.value = false; // clear lingering red error if any
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
