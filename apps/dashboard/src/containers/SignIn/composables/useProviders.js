// Handles provider discovery + normalization + branching into SSO/password
// - No global state created here. We *receive* refs from the caller (page)
// - Keeps your current internal provider names: 'google', 'clever', 'classlink', 'nycps', 'password'
import { toValue } from 'vue';

/**
 * @param {{
 *   // refs from the page (SINGLE SOURCE OF TRUTH)
 *   email: import('vue').Ref<string>,
 *   isUsername: import('vue').ComputedRef<boolean>,
 *   availableProviders: import('vue').Ref<string[]>,
 *   hasCheckedProviders: import('vue').Ref<boolean>,
 *   multipleProviders: import('vue').Ref<boolean>,
 *   hideProviders: import('vue').Ref<boolean>,
 *   showPasswordField: import('vue').Ref<boolean>,
 *
 *   // deps
 *   roarfirekit: import('vue').Ref<any>,          // authStore.roarfirekit
 *
 *   // actions to run for single-provider auto-continue
 *   authWithGoogle?: () => void,
 *   authWithClever?: () => void,
 *   authWithClassLink?: () => void,
 *   authWithNYCPS?: () => void,
 *
 *   // optional: clear error when entering chooser
 *   invalid?: import('vue').Ref<boolean>,
 * }} options
 */
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
  function normalizeProviders(ids = []) {
    const out = new Set();
    const list = Array.isArray(ids) ? ids : [];

    for (const id of list) {
      const lower = String(id || '').toLowerCase();

      // password & email link collapse to the password UI flow
      if (lower.includes('password') || lower.includes('email')) out.add('password');

      // google (various aliases)
      if (lower.includes('google')) out.add('google');

      // district OIDC providers
      if (lower.includes('clever')) out.add('clever');
      if (lower.includes('classlink')) out.add('classlink');
      if (lower.includes('nycps')) out.add('nycps');
    }
    return [...out];
  }

  /** Fetch providers for current email and update refs */
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

    // fetch & normalize
    const providers = await getProviders();

    // multi SSO chooser?
    const sso = providers.filter((p) => ['google', 'clever', 'classlink', 'nycps'].includes(p));
    multipleProviders.value = sso.length > 1;

    if (multipleProviders.value) {
      hideProviders.value = false; // show chooser
      showPasswordField.value = false; // stay on non-password view
      if (invalid) invalid.value = false; // clear lingering red error if any
      return;
    }

    // single SSO → auto continue
    if (providers.includes('google')) return authWithGoogle?.();
    if (providers.includes('clever')) return authWithClever?.();
    if (providers.includes('classlink')) return authWithClassLink?.();
    if (providers.includes('nycps')) return authWithNYCPS?.();

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
