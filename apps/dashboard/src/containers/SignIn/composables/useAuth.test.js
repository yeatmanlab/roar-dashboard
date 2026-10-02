import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';

const mockResolveUserClaims = vi.fn();
const mockSetGlobalError = vi.fn();

vi.mock('@/helpers/resolveUserClaims', () => ({
  resolveUserClaims: () => mockResolveUserClaims(),
}));

vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({ setGlobalError: mockSetGlobalError }),
}));

vi.mock('@sentry/vue', () => ({
  setUser: vi.fn(),
}));

vi.mock('@/services/AuthService', () => ({
  getAuthService: () => ({
    fetchSignInMethodsForEmail: vi.fn().mockResolvedValue([]),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  }),
}));

const { useAuth } = await import('./useAuth');

const MOCK_UID = 'firebase-uid-1';

/**
 * Build the context object `useAuth` destructures, backed by a minimal fake
 * auth store. `uid` is exposed through a getter over a ref so the composable's
 * post-sign-in redirect `watch` can observe transitions; tests drive it via
 * the returned `uidRef`.
 */
function createContext({ uid = MOCK_UID, spinner = false, redirectError = null } = {}) {
  const uidRef = ref(uid);
  // `uid` and `redirectError` are getters over refs so the composable's
  // `watch`es observe transitions; tests drive them via `uidRef` /
  // `redirectErrorRef`.
  const redirectErrorRef = ref(redirectError);
  const authStore = {
    get uid() {
      return uidRef.value;
    },
    roarUid: null,
    userClaims: null,
    get redirectError() {
      return redirectErrorRef.value;
    },
    set redirectError(value) {
      redirectErrorRef.value = value;
    },
    spinner: ref(spinner),
    ssoProvider: ref(null),
    roarfirekit: ref(null),
    logInWithEmailAndPassword: vi.fn().mockResolvedValue(undefined),
    signInWithPopup: vi.fn().mockResolvedValue(undefined),
    signInWithRedirect: vi.fn(),
    initiateLoginWithEmailLink: vi.fn().mockResolvedValue(undefined),
  };

  return {
    authStore,
    uidRef,
    redirectErrorRef,
    router: { push: vi.fn().mockResolvedValue(undefined) },
    route: { query: {} },
    email: ref('teacher@example.org'),
    password: ref('correct-horse'),
    invalid: ref(false),
    ssoError: ref(false),
    emailLinkSent: ref(false),
    showPasswordField: ref(true),
    resetSignInUI: vi.fn(),
  };
}

// `useAuth` reads spinner/ssoProvider/roarfirekit through `storeToRefs`, which
// requires a real Pinia store. The fake store already exposes them as refs, so
// a pass-through keeps the composable working without standing up Pinia.
vi.mock('pinia', () => ({
  storeToRefs: (store) => ({
    spinner: store.spinner,
    ssoProvider: store.ssoProvider,
    roarfirekit: store.roarfirekit,
  }),
}));

describe('useAuth — credential vs. bootstrap error separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('authWithEmailPassword', () => {
    it('flags the form as invalid when the credentials are rejected', async () => {
      const context = createContext();
      context.authStore.logInWithEmailAndPassword.mockRejectedValue(new Error('auth/wrong-password'));

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.invalid.value).toBe(true);
      expect(mockSetGlobalError).not.toHaveBeenCalled();
      // The bootstrap never ran — the credentials never passed.
      expect(mockResolveUserClaims).not.toHaveBeenCalled();
    });

    it('does not flag the credentials when the post-login bootstrap fails', async () => {
      // The acceptance criterion: sign-in succeeded, so the form must NOT
      // silently reset and re-prompt for a password that is already right.
      // Classification of the failure is not asserted here — it belongs to the
      // QueryCache bridge (see the integration test at the bottom of this file).
      const context = createContext();
      mockResolveUserClaims.mockRejectedValue(new Error('/me request failed with status 500'));

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.invalid.value).toBe(false);
      expect(context.authStore.spinner.value).toBe(false);
    });

    it('leaves the form clean and sets no global error on a fully successful sign-in', async () => {
      const context = createContext();
      mockResolveUserClaims.mockResolvedValue({ claims: { roarUid: 'roar-1' } });

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.invalid.value).toBe(false);
      expect(mockSetGlobalError).not.toHaveBeenCalled();
      expect(context.authStore.userClaims).toEqual({ claims: { roarUid: 'roar-1' } });
    });

    // The spinner is auth-store state rendered app-wide by App.vue, so leaving it
    // set outlives the sign-in form and overlays whatever the redirect lands on.
    // `getUserClaims` can resolve without signing anyone in — it no-ops when the
    // uid is absent — so clearing only in the catch is not enough.
    it('clears the spinner when the bootstrap resolves without claims', async () => {
      const context = createContext({ uid: null });

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.authStore.spinner.value).toBe(false);
      expect(mockSetGlobalError).not.toHaveBeenCalled();
    });

    it('clears the spinner on a successful sign-in', async () => {
      const context = createContext();
      mockResolveUserClaims.mockResolvedValue({ claims: { roarUid: 'roar-1' } });

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.authStore.spinner.value).toBe(false);
    });
  });

  describe('SSO popup flow', () => {
    it('flags the SSO error, not the credentials, when the popup sign-in is rejected', async () => {
      const context = createContext();
      context.authStore.signInWithPopup.mockRejectedValue(new Error('auth/popup-closed-by-user'));

      const { authWithGoogle } = useAuth(context);
      await authWithGoogle();
      // `ssoError`, not `invalid`: the user never typed a password, so the
      // invalid-credentials copy would misdirect them into password resets.
      await vi.waitFor(() => expect(context.ssoError.value).toBe(true));
      expect(context.invalid.value).toBe(false);

      // Guard against a vacuous pass: Google on a desktop UA takes the popup
      // branch, not the redirect branch.
      expect(context.authStore.signInWithPopup).toHaveBeenCalledWith('google');
      expect(mockSetGlobalError).not.toHaveBeenCalled();
    });

    it('does not flag the credentials when the popup succeeds but the bootstrap fails', async () => {
      const context = createContext();
      mockResolveUserClaims.mockRejectedValue(new Error('/me request failed with status 500'));

      const { authWithGoogle } = useAuth(context);
      await authWithGoogle();
      await flushPromises();

      expect(context.authStore.signInWithPopup).toHaveBeenCalledWith('google');
      expect(context.invalid.value).toBe(false);
      expect(context.authStore.spinner.value).toBe(false);
    });
  });

  describe('post-sign-in redirect wiring', () => {
    it('redirects to the sign-in redirect path when the uid becomes set', async () => {
      const context = createContext({ uid: null });
      useAuth(context);

      context.uidRef.value = MOCK_UID;
      await flushPromises();

      expect(context.router.push).toHaveBeenCalledTimes(1);
      expect(context.router.push).toHaveBeenCalledWith({ path: '/' });
    });

    it('redirects to the SSO landing page when an SSO provider is active', async () => {
      const context = createContext({ uid: null });
      context.authStore.ssoProvider.value = 'clever';
      useAuth(context);

      context.uidRef.value = MOCK_UID;
      await flushPromises();

      expect(context.router.push).toHaveBeenCalledTimes(1);
      expect(context.router.push).toHaveBeenCalledWith({ path: '/sso', query: {} });
    });

    it('carries redirect_to onto the SSO landing page so the deep-link target survives', async () => {
      // The router guard preserves redirect_to only for unauthenticated users;
      // the user is signed in by the time this fires, so useAuth must forward it.
      const context = createContext({ uid: null });
      context.authStore.ssoProvider.value = 'clever';
      context.route.query = { redirect_to: '/scores/123' };
      useAuth(context);

      context.uidRef.value = MOCK_UID;
      await flushPromises();

      expect(context.router.push).toHaveBeenCalledWith({ path: '/sso', query: { redirect_to: '/scores/123' } });
    });

    it('fires exactly once — later uid changes and store mutations do not re-push', async () => {
      // The regression this replaces: a store-wide $subscribe pushed a route
      // on EVERY store mutation while uid was truthy, racing the router
      // guard's TOS/permission redirects long after the first navigation.
      const context = createContext({ uid: null });
      useAuth(context);

      context.uidRef.value = MOCK_UID;
      await flushPromises();
      context.authStore.spinner.value = true;
      context.uidRef.value = 'another-uid';
      await flushPromises();

      expect(context.router.push).toHaveBeenCalledTimes(1);
    });

    it('does not bounce a signed-in user who deliberately visits the page', async () => {
      // e.g. navigating to SignIn to sign out while TOS is unsigned: the uid
      // is already set when the composable mounts and no redirect bootstrap
      // is in progress (spinner off), so the user must be left on the page.
      const context = createContext({ uid: MOCK_UID, spinner: false });
      useAuth(context);
      await flushPromises();

      expect(context.router.push).not.toHaveBeenCalled();
    });

    it('redirects at mount when returning from an SSO redirect (uid restored during boot)', async () => {
      // awaitAuthReady marks the post-redirect bootstrap window by holding
      // the spinner; the uid never transitions after mount, so the watch
      // alone would leave the user stranded on SignIn.
      const context = createContext({ uid: MOCK_UID, spinner: true });
      context.authStore.ssoProvider.value = 'clever';
      useAuth(context);
      await flushPromises();

      expect(context.router.push).toHaveBeenCalledTimes(1);
      expect(context.router.push).toHaveBeenCalledWith({ path: '/sso', query: {} });
      // The spinner is released once the navigation settles — SignIn is its
      // only consumer, and a persisted `true` would blur the form on the
      // next visit.
      expect(context.authStore.spinner.value).toBe(false);
    });

    it('surfaces a redirect failure already on the store at mount as the SSO error banner and consumes it', () => {
      const context = createContext({ uid: null, redirectError: new Error('auth/account-exists') });
      useAuth(context);

      expect(context.ssoError.value).toBe(true);
      expect(context.authStore.redirectError).toBe(null);
    });

    it('surfaces a redirect failure written AFTER mount (first-navigation-beats-createAuthService ordering)', async () => {
      // SignIn can mount before the store write lands; a one-shot read would
      // miss it, so the consumption is a reactive watch with immediate:true.
      const context = createContext({ uid: null });
      useAuth(context);
      expect(context.ssoError.value).toBe(false);

      context.redirectErrorRef.value = new Error('auth/account-exists');
      await flushPromises();

      expect(context.ssoError.value).toBe(true);
      expect(context.authStore.redirectError).toBe(null);
    });
  });
});
