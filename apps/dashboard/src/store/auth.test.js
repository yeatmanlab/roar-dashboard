import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  onIdTokenChanged: vi.fn(),
  resetQueries: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  getIdToken: vi.fn(),
  getCurrentUser: vi.fn(),
  authReady: vi.fn(),
  initializeFirekit: vi.fn(),
  setGlobalError: vi.fn(),
}));

vi.mock('@/services/AuthService', () => ({
  getAuthService: () => ({
    onIdTokenChanged: mocks.onIdTokenChanged,
    signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
    getIdToken: mocks.getIdToken,
    getCurrentUser: mocks.getCurrentUser,
    authReady: mocks.authReady,
  }),
}));

vi.mock('@/queryClient', () => ({
  queryClient: {
    resetQueries: mocks.resetQueries,
  },
}));

vi.mock('@/firekit', () => ({
  initializeFirekit: mocks.initializeFirekit,
}));

vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({ setGlobalError: mocks.setGlobalError }),
}));

import { useAuthStore } from '@/store/auth';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';

describe('authStore.hasPasswordProvider', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('reflects whether the current Firebase user has a password provider', () => {
    const authStore = useAuthStore();

    expect(authStore.hasPasswordProvider).toBe(false);

    authStore.firebaseUser = { providerData: [{ providerId: 'google.com' }] };
    expect(authStore.hasPasswordProvider).toBe(false);

    authStore.firebaseUser = { providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] };
    expect(authStore.hasPasswordProvider).toBe(true);
  });
});

describe('authStore.setAuthStateListener', () => {
  let authStore;
  /** @type {(user: object | null) => Promise<void>} */
  let listenerCallback;

  const userA = { uid: 'firebase-uid-a' };
  const userB = { uid: 'firebase-uid-b' };

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mocks.resetQueries.mockResolvedValue(undefined);
    mocks.getIdToken.mockResolvedValue('token-from-service');
    mocks.onIdTokenChanged.mockImplementation((callback) => {
      listenerCallback = callback;
      return vi.fn(); // unsubscribe handle
    });
    authStore = useAuthStore();
    authStore.setAuthStateListener();
  });

  it('derives the token via the public AuthService.getIdToken(), not the private user.accessToken field', async () => {
    // The user object carries the internal `accessToken` field, but the store
    // must ignore it and use the public API instead.
    mocks.getIdToken.mockResolvedValue('public-api-token');

    await listenerCallback({ uid: userA.uid, accessToken: 'private-field-token' });

    expect(mocks.getIdToken).toHaveBeenCalledTimes(1);
    expect(authStore.accessToken).toBe('public-api-token');
  });

  it('does not resurrect a token when a sign-out lands while getIdToken is pending', async () => {
    let resolveToken;
    mocks.getIdToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
    );

    // Sign-in event suspends at getIdToken; the sign-out event completes
    // fully before the token resolves.
    const signInEvent = listenerCallback(userA);
    await listenerCallback(null);
    resolveToken('token-a');
    await signInEvent;

    expect(authStore.firebaseUser).toBeNull();
    expect(authStore.accessToken).toBeNull();
  });

  it('does not resurrect a token when a user switch lands while getIdToken is pending', async () => {
    let resolveTokenA;
    mocks.getIdToken
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveTokenA = resolve;
          }),
      )
      .mockResolvedValueOnce('token-b');

    // User A's event suspends at getIdToken; user B's event completes fully
    // before A's token resolves.
    const signInEventA = listenerCallback(userA);
    await listenerCallback(userB);
    resolveTokenA('token-a');
    await signInEventA;

    expect(authStore.firebaseUser.uid).toBe(userB.uid);
    expect(authStore.accessToken).toBe('token-b');
  });

  it('does not reset identity on a same-uid token refresh', async () => {
    await listenerCallback(userA);
    mocks.resetQueries.mockClear();
    authStore.userClaims = { claims: { roarUid: 'roar-a' } };

    // Token refresh: same uid, new token.
    mocks.getIdToken.mockResolvedValue('token-a-refreshed');
    await listenerCallback({ uid: userA.uid });

    expect(mocks.resetQueries).not.toHaveBeenCalled();
    expect(authStore.userClaims).toEqual({ claims: { roarUid: 'roar-a' } });
    expect(authStore.accessToken).toBe('token-a-refreshed');
    expect(authStore.firebaseUser.uid).toBe(userA.uid);
  });

  it('resets identity when a different user signs in (A→B)', async () => {
    await listenerCallback(userA);
    mocks.resetQueries.mockClear();
    authStore.userClaims = { claims: { super_admin: true } };
    authStore.userData = { id: 'user-a' };

    mocks.getIdToken.mockResolvedValue('token-b');
    await listenerCallback(userB);

    expect(mocks.resetQueries).toHaveBeenCalledTimes(1);
    expect(mocks.resetQueries).toHaveBeenCalledWith({ queryKey: [ME_QUERY_KEY] });
    // The persisted store copies of user A's identity must be cleared too —
    // userClaims is the router guard's super-admin fallback.
    expect(authStore.userClaims).toBeNull();
    expect(authStore.userData).toBeNull();
    expect(authStore.firebaseUser.uid).toBe(userB.uid);
    expect(authStore.accessToken).toBe('token-b');
  });

  it('writes the new user to the store before resetting the /me cache', async () => {
    await listenerCallback(userA);
    mocks.resetQueries.mockClear();

    // The refetch triggered by resetQueries must run with the new token, so
    // the store write has to precede the reset.
    let accessTokenAtReset;
    mocks.resetQueries.mockImplementation(() => {
      accessTokenAtReset = authStore.accessToken;
      return Promise.resolve();
    });

    mocks.getIdToken.mockResolvedValue('token-b');
    await listenerCallback(userB);

    expect(accessTokenAtReset).toBe('token-b');
  });

  it('resets identity on sign-out (A→null), even when the sign-out mutation is bypassed', async () => {
    await listenerCallback(userA);
    mocks.resetQueries.mockClear();
    authStore.userClaims = { claims: { super_admin: true } };

    await listenerCallback(null);

    expect(mocks.resetQueries).toHaveBeenCalledTimes(1);
    expect(mocks.resetQueries).toHaveBeenCalledWith({ queryKey: [ME_QUERY_KEY] });
    expect(authStore.userClaims).toBeNull();
    expect(authStore.userData).toBeNull();
    expect(authStore.firebaseUser).toBeNull();
    expect(authStore.accessToken).toBeNull();
  });

  it('resets identity on the first sign-in after a fresh start (null→A)', async () => {
    // No prior listener invocation: previous uid is undefined, so the
    // incoming uid counts as different. Resetting here is harmless — there is
    // nothing (or only a stale entry from a previous session) to drop.
    await listenerCallback(userA);

    expect(mocks.resetQueries).toHaveBeenCalledTimes(1);
    expect(mocks.resetQueries).toHaveBeenCalledWith({ queryKey: [ME_QUERY_KEY] });
    expect(authStore.firebaseUser.uid).toBe(userA.uid);
  });

  it('does not reset when the listener first fires unauthenticated (null→null)', async () => {
    await listenerCallback(null);

    expect(mocks.resetQueries).not.toHaveBeenCalled();
  });

  it('does not throw when resetQueries rejects (fire-and-forget)', async () => {
    mocks.resetQueries.mockRejectedValue(new Error('refetch failed'));

    await expect(listenerCallback(userA)).resolves.toBeUndefined();
  });
});

describe('authStore sign-in initiators', () => {
  let authStore;

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mocks.resetQueries.mockResolvedValue(undefined);
    authStore = useAuthStore();
  });

  it('logInWithEmailAndPassword resets identity BEFORE delegating to the AuthService', async () => {
    // Starting a new sign-in must clear the previous identity's caches first,
    // so no interleaving of the post-sign-in claims fetch and the auth
    // listener can serve the previous user's cached /me to the new one.
    const callOrder = [];
    mocks.resetQueries.mockImplementation(() => {
      callOrder.push('resetQueries');
      return Promise.resolve();
    });
    mocks.signInWithEmailAndPassword.mockImplementation(() => {
      callOrder.push('signIn');
      return Promise.resolve();
    });
    authStore.userClaims = { claims: { super_admin: true } };

    await authStore.logInWithEmailAndPassword({ email: 'a@b.c', password: 'pw' });

    expect(callOrder).toEqual(['resetQueries', 'signIn']);
    expect(authStore.userClaims).toBeNull();
    expect(authStore.userData).toBeNull();
  });
});

describe('authStore.forceIdTokenRefresh', () => {
  let authStore;

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    authStore = useAuthStore();
  });

  it('force-refreshes via AuthService.getIdToken and captures the token synchronously', async () => {
    authStore.accessToken = 'stale-token';
    mocks.getCurrentUser.mockReturnValue({ uid: 'firebase-uid-a' });
    mocks.getIdToken.mockResolvedValue('fresh-token');

    const result = await authStore.forceIdTokenRefresh();

    expect(mocks.getIdToken).toHaveBeenCalledWith(true);
    expect(result).toBe('fresh-token');
    expect(authStore.accessToken).toBe('fresh-token');
  });

  it('shares a single in-flight refresh across concurrent callers', async () => {
    mocks.getCurrentUser.mockReturnValue({ uid: 'firebase-uid-a' });
    let resolveToken;
    mocks.getIdToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
    );

    const first = authStore.forceIdTokenRefresh();
    const second = authStore.forceIdTokenRefresh();
    resolveToken('fresh-token');

    await expect(first).resolves.toBe('fresh-token');
    await expect(second).resolves.toBe('fresh-token');
    expect(mocks.getIdToken).toHaveBeenCalledTimes(1);
  });

  it('starts a new refresh after the previous in-flight refresh settles', async () => {
    mocks.getCurrentUser.mockReturnValue({ uid: 'firebase-uid-a' });
    mocks.getIdToken.mockResolvedValue('fresh-token');

    await authStore.forceIdTokenRefresh();
    await authStore.forceIdTokenRefresh();

    expect(mocks.getIdToken).toHaveBeenCalledTimes(2);
  });

  it('does not store the token when a sign-out lands while the refresh is pending', async () => {
    authStore.accessToken = 'stale-token';
    // Signed in when the refresh starts, signed out by the time it resolves.
    mocks.getCurrentUser.mockReturnValueOnce({ uid: 'firebase-uid-a' }).mockReturnValueOnce(null);
    mocks.getIdToken.mockResolvedValue('fresh-token');

    const result = await authStore.forceIdTokenRefresh();

    expect(result).toBeNull();
    // The auth listener owns clearing the token on sign-out.
    expect(authStore.accessToken).toBe('stale-token');
  });

  it('returns null and leaves the stored token untouched when not signed in', async () => {
    authStore.accessToken = 'stale-token';
    mocks.getCurrentUser.mockReturnValue(null);
    mocks.getIdToken.mockResolvedValue(null);

    const result = await authStore.forceIdTokenRefresh();

    expect(result).toBeNull();
    expect(authStore.accessToken).toBe('stale-token');
  });
});

describe('authStore.initFirekit', () => {
  let authStore;

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    authStore = useAuthStore();
  });

  it('stores the firekit instance and sets no global error on success', async () => {
    mocks.initializeFirekit.mockResolvedValue({ id: 'firekit' });

    await authStore.initFirekit();

    expect(authStore.roarfirekit).toEqual({ id: 'firekit' });
    expect(mocks.setGlobalError).not.toHaveBeenCalled();
  });

  it('routes an initialization failure to the global error mechanism', async () => {
    // Previously this only logged, leaving the app in an unusable session with
    // no visible error. The router's beforeEach guard reads globalError and
    // redirects to GenericError.
    mocks.initializeFirekit.mockRejectedValue(new Error('firekit boom'));

    await authStore.initFirekit();

    expect(mocks.setGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
    expect(authStore.roarfirekit).toBeNull();
  });
});

describe('authStore.awaitAuthReady', () => {
  let authStore;

  const readyState = (overrides = {}) => ({
    user: null,
    accessToken: null,
    isFromRedirect: false,
    initError: null,
    redirectError: null,
    tokenError: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    authStore = useAuthStore();
  });

  it('holds the spinner for a session just established by a redirect return', async () => {
    mocks.authReady.mockResolvedValue(readyState({ user: { uid: 'sso-user' }, isFromRedirect: true }));

    await authStore.awaitAuthReady();

    expect(authStore.spinner).toBe(true);
  });

  it('clears the spinner for a session restored on an ordinary load', async () => {
    // Regression guard: keying the spinner on session presence instead of
    // the redirect result left `spinner: true` in the persisted store on
    // every signed-in reload, with no owner to clear it — SignIn would
    // render a permanent blur overlay the next time the user landed there
    // (e.g. after auth expiry). Only a redirect return is mid-sign-in.
    authStore.spinner = true; // stale persisted value
    mocks.authReady.mockResolvedValue(readyState({ user: { uid: 'user-1' } }));

    await authStore.awaitAuthReady();

    expect(authStore.spinner).toBe(false);
  });

  it('records a redirect failure and does not hold the spinner', async () => {
    const redirectError = new Error('auth/account-exists-with-different-credential');
    mocks.authReady.mockResolvedValue(readyState({ isFromRedirect: true, redirectError }));

    await authStore.awaitAuthReady();

    expect(authStore.redirectError).toBe(redirectError);
    expect(authStore.spinner).toBe(false);
  });

  it('clears a stale persisted redirectError on a boot without one', async () => {
    authStore.redirectError = new Error('stale');
    mocks.authReady.mockResolvedValue(readyState());

    await authStore.awaitAuthReady();

    expect(authStore.redirectError).toBeNull();
  });

  it('writes the access token from the readiness state so the gate opens with it set', async () => {
    // The guarantee the readiness gate sells: when it resolves, accessToken is
    // already present — so the SSO readiness page does not read `!accessToken`
    // on mount and bounce a successful sign-in back to SignIn.
    mocks.authReady.mockResolvedValue(readyState({ user: { uid: 'user-1' }, accessToken: 'id-token-1' }));

    await authStore.awaitAuthReady();

    expect(authStore.accessToken).toBe('id-token-1');
  });

  it('leaves the access token null for a signed-out boot', async () => {
    authStore.accessToken = 'stale-token'; // stale persisted value
    mocks.authReady.mockResolvedValue(readyState());

    await authStore.awaitAuthReady();

    expect(authStore.accessToken).toBeNull();
  });

  it('applies the boot state only once — a second call must not restore the boot token after sign-out', async () => {
    // The router guard awaits awaitAuthReady on EVERY navigation, and the
    // service memoizes the boot state. Without memoizing the store-side
    // continuation, the navigation after a sign-out would write the stale
    // boot token back over the null the listener wrote.
    mocks.authReady.mockResolvedValue(readyState({ user: { uid: 'user-1' }, accessToken: 'boot-token' }));

    await authStore.awaitAuthReady();
    expect(authStore.accessToken).toBe('boot-token');

    // The long-lived listener clears the token on sign-out.
    authStore.accessToken = null;

    await authStore.awaitAuthReady();

    expect(authStore.accessToken).toBeNull();
    expect(mocks.authReady).toHaveBeenCalledTimes(1);
  });

  it('does not re-hold the redirect spinner on a later call', async () => {
    mocks.authReady.mockResolvedValue(readyState({ user: { uid: 'sso-user' }, isFromRedirect: true }));

    await authStore.awaitAuthReady();
    expect(authStore.spinner).toBe(true);

    // The post-sign-in flow releases the spinner; the next navigation's gate
    // call must not re-engage it.
    authStore.spinner = false;

    await authStore.awaitAuthReady();

    expect(authStore.spinner).toBe(false);
  });

  it('shares one continuation across concurrent callers (initAuth and the guard)', async () => {
    let resolveReady;
    mocks.authReady.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReady = resolve;
        }),
    );

    const first = authStore.awaitAuthReady();
    const second = authStore.awaitAuthReady();
    resolveReady(readyState({ user: { uid: 'user-1' }, accessToken: 'boot-token' }));

    await Promise.all([first, second]);

    expect(mocks.authReady).toHaveBeenCalledTimes(1);
    expect(authStore.accessToken).toBe('boot-token');
  });

  it('degrades to a null token (and logs) when readiness reports a token failure', async () => {
    // An offline reload with an expired token: the session is present but the
    // token could not be resolved. The gate must still open (no throw), with a
    // null token rather than a stale one.
    authStore.accessToken = 'stale-token';
    const tokenError = new Error('auth/network-request-failed');
    mocks.authReady.mockResolvedValue(readyState({ user: { uid: 'user-1' }, accessToken: null, tokenError }));

    await authStore.awaitAuthReady();

    expect(authStore.accessToken).toBeNull();
    expect(console.error).toHaveBeenCalledWith('Error resolving the access token during auth readiness:', tokenError);
  });
});
