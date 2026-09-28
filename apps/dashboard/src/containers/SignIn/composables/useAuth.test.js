import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ROUTES } from '@/constants/routes';

const mocks = vi.hoisted(() => ({
  isMobileBrowser: vi.fn(),
  resolveUserClaims: vi.fn(),
  setGlobalError: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store) => store.$refs,
}));

vi.mock('@sentry/vue', () => ({ setUser: mocks.setUser }));
vi.mock('@/helpers', () => ({ isMobileBrowser: mocks.isMobileBrowser }));
vi.mock('@/helpers/resolveUserClaims', () => ({ resolveUserClaims: mocks.resolveUserClaims }));
vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({ setGlobalError: mocks.setGlobalError }),
}));
vi.mock('@/services/AuthService', () => ({
  getAuthService: () => ({
    fetchSignInMethodsForEmail: vi.fn().mockResolvedValue([]),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { useAuth } from './useAuth';

const MOCK_UID = 'firebase-uid-1';

function createContext({ uid = MOCK_UID, route = { query: {} } } = {}) {
  let authSubscription;
  const authStore = {
    $refs: {
      spinner: ref(false),
      ssoProvider: ref(null),
      roarfirekit: ref(null),
    },
    $subscribe: vi.fn((callback) => {
      authSubscription = callback;
    }),
    uid,
    roarUid: null,
    userClaims: null,
    logInWithEmailAndPassword: vi.fn().mockResolvedValue(undefined),
    signInWithPopup: vi.fn().mockResolvedValue(undefined),
    signInWithRedirect: vi.fn().mockResolvedValue(undefined),
    initiateLoginWithEmailLink: vi.fn().mockResolvedValue(undefined),
  };
  const router = { push: vi.fn() };
  const context = {
    authStore,
    router,
    route,
    email: ref('owner@example.com'),
    password: ref('password1'),
    invalid: ref(false),
    ssoError: ref(false),
    emailLinkSent: ref(false),
    showPasswordField: ref(true),
    resetSignInUI: vi.fn(),
  };

  return { authStore, authSubscription: () => authSubscription, context, router };
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.isMobileBrowser.mockReturnValue(false);
    mocks.resolveUserClaims.mockResolvedValue({ claims: { roarUid: 'roar-owner' } });
    delete window.Cypress;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('credential vs. bootstrap error separation', () => {
    it('flags the form as invalid when the credentials are rejected', async () => {
      const { context } = createContext();
      context.authStore.logInWithEmailAndPassword.mockRejectedValue(new Error('auth/wrong-password'));

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.invalid.value).toBe(true);
      expect(mocks.setGlobalError).not.toHaveBeenCalled();
      expect(mocks.resolveUserClaims).not.toHaveBeenCalled();
    });

    it('does not flag the credentials when the post-login bootstrap fails', async () => {
      const { context } = createContext();
      mocks.resolveUserClaims.mockRejectedValue(new Error('/me request failed with status 500'));

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.invalid.value).toBe(false);
      expect(context.authStore.$refs.spinner.value).toBe(false);
    });

    it('leaves the form clean and sets no global error on a fully successful sign-in', async () => {
      const { context } = createContext();
      mocks.resolveUserClaims.mockResolvedValue({ claims: { roarUid: 'roar-1' } });

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.invalid.value).toBe(false);
      expect(mocks.setGlobalError).not.toHaveBeenCalled();
      expect(context.authStore.userClaims).toEqual({ claims: { roarUid: 'roar-1' } });
    });

    it('clears the spinner when the bootstrap resolves without claims', async () => {
      const { context } = createContext({ uid: null });

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.authStore.$refs.spinner.value).toBe(false);
      expect(mocks.setGlobalError).not.toHaveBeenCalled();
    });

    it('clears the spinner on a successful sign-in', async () => {
      const { context } = createContext();
      mocks.resolveUserClaims.mockResolvedValue({ claims: { roarUid: 'roar-1' } });

      const { authWithEmailPassword } = useAuth(context);
      await authWithEmailPassword();

      expect(context.authStore.$refs.spinner.value).toBe(false);
    });
  });

  describe('SSO popup flow', () => {
    it('flags the SSO error, not the credentials, when the popup sign-in is rejected', async () => {
      const { context } = createContext();
      context.authStore.signInWithPopup.mockRejectedValue(new Error('auth/popup-closed-by-user'));

      const { authWithGoogle } = useAuth(context);
      authWithGoogle();

      await vi.waitFor(() => expect(context.ssoError.value).toBe(true));
      expect(context.invalid.value).toBe(false);
      expect(context.authStore.signInWithPopup).toHaveBeenCalledWith('google');
      expect(mocks.setGlobalError).not.toHaveBeenCalled();
    });

    it('does not flag the credentials when the popup succeeds but the bootstrap fails', async () => {
      const { context } = createContext();
      mocks.resolveUserClaims.mockRejectedValue(new Error('/me request failed with status 500'));

      const { authWithGoogle } = useAuth(context);
      authWithGoogle();
      await flushPromises();

      expect(context.authStore.signInWithPopup).toHaveBeenCalledWith('google');
      expect(context.invalid.value).toBe(false);
      expect(context.authStore.$refs.spinner.value).toBe(false);
    });
  });

  describe('signup QA regressions', () => {
    it('preserves the email/password sign-in contract', async () => {
      const { authStore, context } = createContext();
      const auth = useAuth(context);

      await auth.authWithEmailPassword();

      expect(authStore.logInWithEmailAndPassword).toHaveBeenCalledWith({
        email: 'owner@example.com',
        password: 'password1',
      });
      expect(authStore.$refs.spinner.value).toBe(false);
      expect(mocks.resolveUserClaims).toHaveBeenCalledOnce();
    });

    it('preserves provider redirect and popup behavior', async () => {
      const redirectContext = createContext();
      const redirectAuth = useAuth(redirectContext.context);

      redirectAuth.authWithClever();
      expect(redirectContext.authStore.$refs.spinner.value).toBe(true);
      expect(redirectContext.authStore.signInWithRedirect).toHaveBeenCalledWith('clever');

      const popupContext = createContext();
      const popupAuth = useAuth(popupContext.context);

      popupAuth.authWithGoogle();
      await flushPromises();

      expect(popupContext.authStore.signInWithPopup).toHaveBeenCalledWith('google');
      expect(mocks.resolveUserClaims).toHaveBeenCalledOnce();
    });

    it('preserves the approved post-authentication navigation path', () => {
      const homeContext = createContext();
      useAuth(homeContext.context);

      homeContext.authSubscription()();
      expect(homeContext.router.push).toHaveBeenCalledWith({ path: APP_ROUTES.HOME });

      const redirectContext = createContext({ route: { query: { redirect_to: '/progress' } } });
      useAuth(redirectContext.context);

      redirectContext.authSubscription()();
      expect(redirectContext.router.push).toHaveBeenCalledWith({ path: '/progress' });

      const ssoContext = createContext();
      useAuth(ssoContext.context);
      ssoContext.authStore.$refs.ssoProvider.value = 'clever';

      ssoContext.authSubscription()();
      expect(ssoContext.router.push).toHaveBeenCalledWith({ path: APP_ROUTES.SSO });
    });
  });
});
