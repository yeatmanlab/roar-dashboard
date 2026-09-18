import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ROUTES } from '@/constants/routes';

const mocks = vi.hoisted(() => ({
  isMobileBrowser: vi.fn(),
  resolveUserClaims: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store) => store.$refs,
}));

vi.mock('@sentry/vue', () => ({ setUser: mocks.setUser }));
vi.mock('@/helpers', () => ({ isMobileBrowser: mocks.isMobileBrowser }));
vi.mock('@/helpers/resolveUserClaims', () => ({ resolveUserClaims: mocks.resolveUserClaims }));
vi.mock('@/services/AuthService', () => ({
  getAuthService: () => ({
    fetchSignInMethodsForEmail: vi.fn().mockResolvedValue([]),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { useAuth } from './useAuth';

function createContext(route = { query: {} }) {
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
    uid: null,
    roarUid: null,
    userClaims: null,
    logInWithEmailAndPassword: vi.fn().mockResolvedValue(undefined),
    signInWithPopup: vi.fn().mockResolvedValue(undefined),
    signInWithRedirect: vi.fn(),
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
    emailLinkSent: ref(false),
    showPasswordField: ref(true),
    resetSignInUI: vi.fn(),
  };

  return { authStore, authSubscription: () => authSubscription, context, router };
}

describe('useAuth regression behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMobileBrowser.mockReturnValue(false);
    mocks.resolveUserClaims.mockResolvedValue({ claims: { roarUid: 'roar-owner' } });
    delete window.Cypress;
  });

  it('preserves the email/password sign-in contract', async () => {
    const { authStore, context } = createContext();
    authStore.uid = 'firebase-owner';
    const auth = useAuth(context);

    auth.authWithEmailPassword();
    await flushPromises();

    expect(authStore.logInWithEmailAndPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'password1',
    });
    expect(authStore.$refs.spinner.value).toBe(true);
    expect(mocks.resolveUserClaims).toHaveBeenCalledOnce();
  });

  it('preserves provider redirect and popup behavior', async () => {
    const redirectContext = createContext();
    const redirectAuth = useAuth(redirectContext.context);

    redirectAuth.authWithClever();
    expect(redirectContext.authStore.$refs.spinner.value).toBe(true);
    expect(redirectContext.authStore.signInWithRedirect).toHaveBeenCalledWith('clever');

    const popupContext = createContext();
    popupContext.authStore.uid = 'firebase-owner';
    const popupAuth = useAuth(popupContext.context);

    popupAuth.authWithGoogle();
    await flushPromises();

    expect(popupContext.authStore.signInWithPopup).toHaveBeenCalledWith('google');
    expect(mocks.resolveUserClaims).toHaveBeenCalledOnce();
  });

  it('preserves the approved post-authentication navigation path', () => {
    const homeContext = createContext();
    useAuth(homeContext.context);
    homeContext.authStore.uid = 'firebase-owner';

    homeContext.authSubscription()();
    expect(homeContext.router.push).toHaveBeenCalledWith({ path: APP_ROUTES.HOME });

    const redirectContext = createContext({ query: { redirect_to: '/progress' } });
    useAuth(redirectContext.context);
    redirectContext.authStore.uid = 'firebase-owner';

    redirectContext.authSubscription()();
    expect(redirectContext.router.push).toHaveBeenCalledWith({ path: '/progress' });

    const ssoContext = createContext();
    useAuth(ssoContext.context);
    ssoContext.authStore.uid = 'firebase-owner';
    ssoContext.authStore.$refs.ssoProvider.value = 'clever';

    ssoContext.authSubscription()();
    expect(ssoContext.router.push).toHaveBeenCalledWith({ path: APP_ROUTES.SSO });
  });
});
