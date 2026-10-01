import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'roar-dashboard-auth' })),
  getApp: vi.fn(() => {
    throw new Error('no app');
  }),
  getAuth: vi.fn(() => ({ currentUser: null })),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  connectAuthEmulator: vi.fn(),
  getRedirectResult: vi.fn().mockResolvedValue(null),
  onIdTokenChanged: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: mocks.initializeApp,
  getApp: mocks.getApp,
}));

vi.mock('firebase/auth', () => ({
  getAuth: mocks.getAuth,
  connectAuthEmulator: mocks.connectAuthEmulator,
  setPersistence: mocks.setPersistence,
  browserSessionPersistence: 'session',
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: mocks.getRedirectResult,
  signInWithEmailLink: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  fetchSignInMethodsForEmail: vi.fn(),
  getIdToken: vi.fn(),
  onIdTokenChanged: mocks.onIdTokenChanged,
  signOut: vi.fn(),
  GoogleAuthProvider: class {},
  OAuthProvider: class {},
}));

const CONFIG = Object.freeze({
  projectId: 'roar-test',
  apiKey: 'test-key',
  authDomain: 'roar-test.firebaseapp.com',
});

/**
 * Build a fresh AuthService. The module memoizes its singleton, so each test
 * re-imports to get an un-memoized `authReady`.
 *
 * @param {object} [config] - Firebase config override.
 * @returns {Promise<object>} The service instance.
 */
const createService = async (config = CONFIG) => {
  vi.resetModules();
  const { createAuthService } = await import('./AuthService');
  return createAuthService(config);
};

/** Emit one `onIdTokenChanged` value to the next subscriber. */
const emitToken = (user) => {
  mocks.onIdTokenChanged.mockImplementation((_auth, callback) => {
    callback(user);
    return vi.fn();
  });
};

describe('AuthService.authReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApp.mockImplementation(() => {
      throw new Error('no app');
    });
    mocks.getAuth.mockReturnValue({ currentUser: null });
    mocks.setPersistence.mockResolvedValue(undefined);
    mocks.getRedirectResult.mockResolvedValue(null);
    emitToken(null);
  });

  it('resolves with the signed-in user once the first token emission lands', async () => {
    const user = { uid: 'user-1' };
    emitToken(user);

    const service = await createService();
    const state = await service.authReady();

    expect(state).toEqual({ user, initError: null, redirectError: null });
  });

  it('resolves with a null user when signed out', async () => {
    const service = await createService();
    const state = await service.authReady();

    expect(state.user).toBeNull();
    expect(state.initError).toBeNull();
  });

  it('consumes the pending redirect before observing the token listener', async () => {
    // Ordering is load-bearing: a returning SSO user is signed in by
    // getRedirectResult, so the emission observed afterwards must already
    // reflect them. Reversing these would report the user as signed out.
    const callOrder = [];
    mocks.getRedirectResult.mockImplementation(async () => {
      callOrder.push('redirect');
      return { user: { uid: 'sso-user' } };
    });
    mocks.onIdTokenChanged.mockImplementation((_auth, callback) => {
      callOrder.push('listener');
      callback({ uid: 'sso-user' });
      return vi.fn();
    });

    const service = await createService();
    await service.authReady();

    expect(callOrder).toEqual(['redirect', 'listener']);
  });

  it('memoizes so concurrent callers share one resolution', async () => {
    const service = await createService();

    const [first, second] = await Promise.all([service.authReady(), service.authReady()]);

    expect(first).toBe(second);
    expect(mocks.getRedirectResult).toHaveBeenCalledTimes(1);
  });

  // The router guard awaits this promise. A rejection there would reject the
  // navigation itself, so every failure comes back as state instead.
  it('reports an initialization failure as state without rejecting', async () => {
    const initError = new Error('auth/invalid-api-key');
    mocks.setPersistence.mockRejectedValue(initError);

    const service = await createService();
    const state = await service.authReady();

    expect(state.initError).toBe(initError);
    expect(state.user).toBeNull();
    // No Firebase instance means no session to observe — don't wait on one.
    expect(mocks.onIdTokenChanged).not.toHaveBeenCalled();
  });

  it('reports a redirect failure as state and still resolves the session', async () => {
    const redirectError = new Error('auth/account-exists-with-different-credential');
    mocks.getRedirectResult.mockRejectedValue(redirectError);

    const service = await createService();
    const state = await service.authReady();

    expect(state.redirectError).toBe(redirectError);
    // A failed redirect leaves the user signed out, not broken: the listener
    // still runs and reports the absent session.
    expect(state.user).toBeNull();
    expect(mocks.onIdTokenChanged).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes after the first emission so the store owns the long-lived listener', async () => {
    const unsubscribe = vi.fn();
    mocks.onIdTokenChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return unsubscribe;
    });

    const service = await createService();
    await service.authReady();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
