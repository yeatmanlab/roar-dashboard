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
 * auth store. `$subscribe` is a no-op here — the post-login redirect wiring is
 * out of scope for these tests (and is tracked separately in #2214).
 */
function createContext({ uid = MOCK_UID } = {}) {
  const authStore = {
    uid,
    roarUid: null,
    userClaims: null,
    spinner: ref(false),
    ssoProvider: ref(null),
    roarfirekit: ref(null),
    $subscribe: vi.fn(),
    logInWithEmailAndPassword: vi.fn().mockResolvedValue(undefined),
    signInWithPopup: vi.fn().mockResolvedValue(undefined),
    signInWithRedirect: vi.fn(),
    initiateLoginWithEmailLink: vi.fn().mockResolvedValue(undefined),
  };

  return {
    authStore,
    router: { push: vi.fn() },
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
});
