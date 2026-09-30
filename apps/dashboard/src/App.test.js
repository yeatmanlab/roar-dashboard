import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';

const mockSetGlobalError = vi.fn();
const mockClearGlobalError = vi.fn();
const mockCreateAuthService = vi.fn();

const authStore = {
  accessToken: null,
  uid: null,
  isAuthenticated: false,
  initAuth: vi.fn().mockResolvedValue(undefined),
  initFirekit: vi.fn().mockResolvedValue(undefined),
  initStateFromRedirect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'Home', meta: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('vue-recaptcha', () => ({ useRecaptchaProvider: vi.fn() }));
vi.mock('@unhead/vue/components', () => ({ Head: { render: () => null } }));
vi.mock('@/store/auth', () => ({ useAuthStore: () => authStore }));
vi.mock('@/services/AuthService', () => ({ createAuthService: mockCreateAuthService }));
vi.mock('@/helpers/resolveUserClaims', () => ({ resolveUserClaims: vi.fn().mockResolvedValue(null) }));
vi.mock('@/translations/i18n', () => ({
  i18n: { global: { locale: ref('en'), fallbackLocale: ref('en') } },
}));
vi.mock('@/composables/useCurrentUser', () => ({
  default: () => ({ data: ref(null), error: ref(null), isFetching: ref(false) }),
}));
vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({ setGlobalError: mockSetGlobalError, clearGlobalError: mockClearGlobalError }),
}));
// Navigation is a heavy container; the redirect watcher has its own test.
vi.mock('@/containers/Navigation/Navigation.vue', () => ({ default: { render: () => null } }));
vi.mock('@/composables/useGlobalErrorRedirect', () => ({ useGlobalErrorRedirect: vi.fn() }));

import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';

const App = (await import('./App.vue')).default;

const mountApp = () =>
  mount(App, {
    global: {
      mocks: { $route: { fullPath: '/' } },
      stubs: { RouterView: true, PvToast: true, AppSpinner: true },
    },
  });

describe('App.vue bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.initAuth.mockResolvedValue(undefined);
  });

  it('runs the bootstrap sequence without touching global error state', async () => {
    mountApp();
    await flushPromises();

    expect(mockCreateAuthService).toHaveBeenCalledTimes(1);
    expect(authStore.initAuth).toHaveBeenCalledTimes(1);
    expect(authStore.initFirekit).toHaveBeenCalledTimes(1);
    expect(authStore.initStateFromRedirect).toHaveBeenCalledTimes(1);
    expect(mockSetGlobalError).not.toHaveBeenCalled();
  });

  // `initAuth` has no internal catch (unlike `initFirekit`). A rejection —
  // missing Firebase config, persistence setup, emulator init — must land on
  // the global error state instead of escaping the lifecycle hook and
  // leaving the app stuck on whatever painted first.
  it('sets SERVER_ERROR and stops the sequence when initAuth rejects', async () => {
    authStore.initAuth.mockRejectedValue(new Error('auth/invalid-api-key'));

    mountApp();
    await flushPromises();

    expect(mockSetGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
    expect(authStore.initFirekit).not.toHaveBeenCalled();
    expect(authStore.initStateFromRedirect).not.toHaveBeenCalled();
  });
});
