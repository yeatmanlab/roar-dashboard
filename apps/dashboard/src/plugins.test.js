import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, readonly } from 'vue';

// Shared spy state for useGlobalError — lets us verify setGlobalError calls
// while sharing the same module-scoped ref that plugins.js will use.
const globalError = ref(null);
const setGlobalError = vi.fn((error) => {
  globalError.value = error;
});
const clearGlobalError = vi.fn(() => {
  globalError.value = null;
});

vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({
    globalError: readonly(globalError),
    setGlobalError,
    clearGlobalError,
  }),
}));

// Pass through real api-errors utilities (pure functions, no side effects)
vi.mock('@/utils/api-errors', () => {
  // Inline the predicates to avoid circular alias resolution
  const API_ERROR_CODES = Object.freeze({
    AUTH_TOKEN_EXPIRED: 'auth/token-expired',
    AUTH_REQUIRED: 'auth/required',
    AUTH_ROSTERING_ENDED: 'auth/rostering-ended',
  });

  function getApiErrorCode(response) {
    if (response?.body?.error?.code && typeof response.body.error.code === 'string') {
      return response.body.error.code;
    }
    if (response?.error?.code && typeof response.error.code === 'string') {
      return response.error.code;
    }
    if (response?.code && typeof response.code === 'string') {
      return response.code;
    }
    return null;
  }

  function isRosteringEndedError(error) {
    return getApiErrorCode(error) === API_ERROR_CODES.AUTH_ROSTERING_ENDED;
  }

  function isTerminalAuthError(error) {
    const code = getApiErrorCode(error);
    return code === API_ERROR_CODES.AUTH_TOKEN_EXPIRED || code === API_ERROR_CODES.AUTH_REQUIRED;
  }

  return { API_ERROR_CODES, getApiErrorCode, isRosteringEndedError, isTerminalAuthError };
});

// Mock all other module-level dependencies of plugins.js
vi.mock('primevue/config', () => ({ default: {} }));
vi.mock('primevue/confirmationservice', () => ({ default: {} }));
vi.mock('primevue/toastservice', () => ({ default: {} }));
vi.mock('@/router/index.js', () => ({ default: {} }));
vi.mock('vue3-text-clamp', () => ({ default: {} }));
vi.mock('vue-google-maps-community-fork', () => ({ default: {} }));
vi.mock('@unhead/vue', () => ({ createHead: () => ({}) }));
vi.mock('@/translations/i18n.js', () => ({ i18n: {} }));
vi.mock('pinia', () => ({
  createPinia: () => ({ use: () => ({}) }),
}));
vi.mock('pinia-plugin-persistedstate', () => ({ default: {} }));
vi.mock('@primevue/themes', () => ({ definePreset: () => ({}) }));
vi.mock('@primevue/themes/aura', () => ({ default: {} }));

describe('TanStack Query onError callback', () => {
  /** @type {Function} */
  let onErrorCallback;

  beforeEach(async () => {
    vi.clearAllMocks();
    globalError.value = null;

    // Import plugins to extract the onError callback.
    // No resetModules() needed — the useGlobalError mock above uses a shared ref
    // so both plugins.js and this test operate on the same state.
    const { default: plugins } = await import('./plugins');
    const vueQueryEntry = plugins.find((entry) => Array.isArray(entry) && entry[1]?.queryClientConfig?.queryCache);
    onErrorCallback = vueQueryEntry[1].queryClientConfig.queryCache.config.onError;
  });

  it('sets rostering-ended global error on auth/rostering-ended', () => {
    const error = { body: { error: { code: 'auth/rostering-ended' } } };
    onErrorCallback(error);

    expect(setGlobalError).toHaveBeenCalledWith({ type: 'rostering-ended' });
    expect(globalError.value).toEqual({ type: 'rostering-ended' });
  });

  it('sets auth-expired global error on auth/token-expired', () => {
    const error = { body: { error: { code: 'auth/token-expired' } } };
    onErrorCallback(error);

    expect(setGlobalError).toHaveBeenCalledWith({ type: 'auth-expired' });
    expect(globalError.value).toEqual({ type: 'auth-expired' });
  });

  it('sets auth-expired global error on auth/required', () => {
    const error = { body: { error: { code: 'auth/required' } } };
    onErrorCallback(error);

    expect(setGlobalError).toHaveBeenCalledWith({ type: 'auth-expired' });
    expect(globalError.value).toEqual({ type: 'auth-expired' });
  });

  it('does not set global error for unrecognized error codes', () => {
    const error = { body: { error: { code: 'some/other-error' } } };
    onErrorCallback(error);

    expect(setGlobalError).not.toHaveBeenCalled();
    expect(globalError.value).toBeNull();
  });
});
