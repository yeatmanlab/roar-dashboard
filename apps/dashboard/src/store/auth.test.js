import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  onIdTokenChanged: vi.fn(),
  resetQueries: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

vi.mock('@/services/AuthService', () => ({
  getAuthService: () => ({
    onIdTokenChanged: mocks.onIdTokenChanged,
    signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
  }),
}));

vi.mock('@/queryClient', () => ({
  queryClient: {
    resetQueries: mocks.resetQueries,
  },
}));

vi.mock('@/firekit', () => ({
  initializeFirekit: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getIdToken: vi.fn(),
}));

import { useAuthStore } from '@/store/auth';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

describe('authStore.setAuthStateListener', () => {
  let authStore;
  /** @type {(user: object | null) => Promise<void>} */
  let listenerCallback;

  const userA = { uid: 'firebase-uid-a', accessToken: 'token-a' };
  const userB = { uid: 'firebase-uid-b', accessToken: 'token-b' };

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mocks.resetQueries.mockResolvedValue(undefined);
    mocks.onIdTokenChanged.mockImplementation((callback) => {
      listenerCallback = callback;
      return vi.fn(); // unsubscribe handle
    });
    authStore = useAuthStore();
    authStore.setAuthStateListener();
  });

  it('does not reset identity on a same-uid token refresh', async () => {
    await listenerCallback(userA);
    mocks.resetQueries.mockClear();
    authStore.userClaims = { claims: { roarUid: 'roar-a' } };

    // Token refresh: same uid, new token.
    await listenerCallback({ uid: userA.uid, accessToken: 'token-a-refreshed' });

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

    await listenerCallback(userB);

    expect(mocks.resetQueries).toHaveBeenCalledTimes(1);
    expect(mocks.resetQueries).toHaveBeenCalledWith({ queryKey: [ME_QUERY_KEY] });
    // The persisted store copies of user A's identity must be cleared too —
    // userClaims is the router guard's super-admin fallback.
    expect(authStore.userClaims).toBeNull();
    expect(authStore.userData).toBeNull();
    expect(authStore.firebaseUser.uid).toBe(userB.uid);
    expect(authStore.accessToken).toBe(userB.accessToken);
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

    await listenerCallback(userB);

    expect(accessTokenAtReset).toBe(userB.accessToken);
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
