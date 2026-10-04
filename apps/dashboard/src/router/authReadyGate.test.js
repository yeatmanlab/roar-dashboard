import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests the auth-readiness gate at the head of `router.beforeEach`.
 *
 * The gate is what makes session presence a synchronous fact for every check
 * downstream — without it, a signed-in user whose Firebase state has not
 * resolved yet reads as signed out and gets bounced to SignIn.
 */

const mocks = vi.hoisted(() => ({
  authReady: vi.fn(),
  getAuthService: vi.fn(),
  logAuthEvent: vi.fn(),
  userCan: vi.fn(() => true),
  globalError: { value: null },
  clearGlobalError: vi.fn(),
  ensureQueryData: vi.fn().mockResolvedValue(null),
  getQueryData: vi.fn(() => ({ unsignedAgreements: [], userType: 'educator' })),
}));

vi.mock('@/services/AuthService', () => ({
  getAuthService: mocks.getAuthService,
}));

vi.mock('@/composables/useSentryLogging', () => ({
  default: () => ({ logNavEvent: vi.fn(), logAuthEvent: mocks.logAuthEvent }),
}));

// The route table reads permission constants at module load, so the mock has
// to carry the same shape the real composable exposes.
vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({
    Permissions: {
      Administrations: { CREATE: 'administrations.create', UPDATE: 'administrations.update' },
      Administrators: { CREATE: 'administrators.create', UPDATE: 'administrators.update' },
      Organizations: { CREATE: 'organizations.create', LIST: 'organizations.list' },
      Reports: {
        Progress: { READ: 'reports.progress.read' },
        Score: { READ: 'reports.score.read' },
        Student: { READ: 'reports.student.read' },
      },
      Tasks: { LAUNCH: 'tasks.launch', UPDATE: 'tasks.update' },
      Users: { CREATE: 'users.create', LIST: 'users.list' },
    },
    userCan: mocks.userCan,
  }),
}));

vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({
    globalError: mocks.globalError,
    clearGlobalError: mocks.clearGlobalError,
  }),
}));

vi.mock('@/queryClient', () => ({
  queryClient: {
    ensureQueryData: mocks.ensureQueryData,
    getQueryData: mocks.getQueryData,
  },
  setProvisioningContextCheck: vi.fn(),
}));

vi.mock('@/composables/queries/useMeQuery', () => ({ fetchMe: vi.fn() }));

// The guard awaits `store.awaitAuthReady()` (not `authService.authReady()`
// directly), so the mock store delegates to the same `authReady` the tests
// drive — mirroring the real action, whose resolution is what the gate waits on.
const authStore = {
  isAuthenticated: false,
  ssoProvider: null,
  userClaims: null,
  awaitAuthReady: vi.fn(() => mocks.getAuthService().authReady()),
};
vi.mock('@/store/auth', () => ({ useAuthStore: () => authStore }));

const { AUTH_READY_TIMEOUT_MS } = await import('@/constants/auth');
const { AUTH_LOG_MESSAGES } = await import('@/constants/logMessages');

/**
 * Load the router and return its single registered `beforeEach` guard.
 *
 * @returns {Promise<Function>} The guard function.
 */
const loadGuard = async () => {
  vi.resetModules();
  const guards = [];

  // Capture the guard the module registers, so it can be invoked directly
  // with synthetic route objects instead of driving a real navigation.
  vi.doMock('vue-router', async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      createRouter: (options) => {
        const router = actual.createRouter(options);
        const originalBeforeEach = router.beforeEach.bind(router);
        router.beforeEach = (guard) => {
          guards.push(guard);
          return originalBeforeEach(guard);
        };
        return router;
      },
    };
  });

  await import('./index');
  return guards[0];
};

/** A navigation target the guard lets through without redirecting. */
const toSignIn = { name: 'SignIn', path: '/signin', fullPath: '/signin', query: {}, meta: {} };
const fromHome = { name: 'Home', path: '/', fullPath: '/', query: {}, meta: {} };

describe('router auth-readiness gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.isAuthenticated = false;
    mocks.globalError.value = null;
    mocks.getAuthService.mockReturnValue({ authReady: mocks.authReady });
    mocks.authReady.mockResolvedValue({ user: null, initError: null, redirectError: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not resolve a navigation before auth readiness settles', async () => {
    let releaseAuthReady;
    mocks.authReady.mockReturnValue(
      new Promise((resolve) => {
        releaseAuthReady = () => resolve({ user: null, initError: null, redirectError: null });
      }),
    );

    const guard = await loadGuard();
    const next = vi.fn();

    const navigation = guard(toSignIn, fromHome, next);
    await Promise.resolve();

    // The whole point of the gate: nothing downstream has run yet.
    expect(next).not.toHaveBeenCalled();

    releaseAuthReady();
    await navigation;

    expect(next).toHaveBeenCalled();
  });

  it('awaits the store readiness action, not authReady() directly', async () => {
    // The guard must await `store.awaitAuthReady()` so that `accessToken` (which
    // that action writes in its continuation) is set before the gate opens —
    // a structural guarantee rather than a microtask-ordering accident.
    const guard = await loadGuard();
    const next = vi.fn();

    await guard(toSignIn, fromHome, next);

    expect(authStore.awaitAuthReady).toHaveBeenCalledTimes(1);
  });

  it('awaits readiness before reading isAuthenticated', async () => {
    // The failure this gate exists to prevent: a signed-in user whose
    // Firebase state resolves mid-navigation. Without the gate the guard
    // reads `isAuthenticated: false` and redirects to SignIn.
    mocks.authReady.mockImplementation(async () => {
      authStore.isAuthenticated = true;
      return { user: { uid: 'user-1' }, initError: null, redirectError: null };
    });

    const guard = await loadGuard();
    const next = vi.fn();

    const protectedRoute = { name: 'Home', path: '/', fullPath: '/', query: {}, meta: {} };
    await guard(protectedRoute, fromHome, next);

    // Not redirected to SignIn — the session was known in time.
    expect(next).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/signin' }));
  });

  it('degrades to signed-out with a warning when readiness times out', async () => {
    vi.useFakeTimers();
    // Never settles — a hung Firebase init.
    mocks.authReady.mockReturnValue(new Promise(() => {}));

    const guard = await loadGuard();
    const next = vi.fn();

    const navigation = guard(toSignIn, fromHome, next);
    await vi.advanceTimersByTimeAsync(AUTH_READY_TIMEOUT_MS);
    await navigation;

    // Fail-open: the router must not freeze forever.
    expect(next).toHaveBeenCalled();
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.AUTH_READY_TIMED_OUT, {
      level: 'warning',
      data: { timeoutMs: AUTH_READY_TIMEOUT_MS, to: toSignIn.fullPath },
    });
  });

  it('does not warn when readiness settles inside the timeout', async () => {
    const guard = await loadGuard();
    const next = vi.fn();

    await guard(toSignIn, fromHome, next);

    expect(mocks.logAuthEvent).not.toHaveBeenCalledWith(AUTH_LOG_MESSAGES.AUTH_READY_TIMED_OUT, expect.anything());
  });

  it('proceeds when the AuthService has not been created yet', async () => {
    // `createAuthService` runs in App.vue's onBeforeMount, which can lose the
    // race to the first navigation. The guard must not throw.
    mocks.getAuthService.mockImplementation(() => {
      throw new Error('AuthService not created. Call createAuthService() first.');
    });

    const guard = await loadGuard();
    const next = vi.fn();

    await expect(guard(toSignIn, fromHome, next)).resolves.not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});
