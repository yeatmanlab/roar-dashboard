import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGlobalError } from '@/composables/useGlobalError';
import { API_ERROR_CODES } from '@/utils/api-errors';

// Mock dependencies that plugins.js imports at module level
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
    vi.resetModules();
    const { clearGlobalError } = useGlobalError();
    clearGlobalError();

    const { default: plugins } = await import('./plugins');
    // Find the VueQueryPlugin entry — it's a [plugin, options] tuple
    const vueQueryEntry = plugins.find((entry) => Array.isArray(entry) && entry[1]?.queryClientConfig?.queryCache);
    onErrorCallback = vueQueryEntry[1].queryClientConfig.queryCache.config.onError;
  });

  it('sets rostering-ended global error on auth/rostering-ended', () => {
    const error = { body: { error: { code: API_ERROR_CODES.AUTH_ROSTERING_ENDED } } };
    onErrorCallback(error);

    const { globalError } = useGlobalError();
    expect(globalError.value).toEqual({ type: 'rostering-ended' });
  });

  it('sets auth-expired global error on auth/token-expired', () => {
    const error = { body: { error: { code: API_ERROR_CODES.AUTH_TOKEN_EXPIRED } } };
    onErrorCallback(error);

    const { globalError } = useGlobalError();
    expect(globalError.value).toEqual({ type: 'auth-expired' });
  });

  it('sets auth-expired global error on auth/required', () => {
    const error = { body: { error: { code: API_ERROR_CODES.AUTH_REQUIRED } } };
    onErrorCallback(error);

    const { globalError } = useGlobalError();
    expect(globalError.value).toEqual({ type: 'auth-expired' });
  });

  it('does not set global error for unrecognized error codes', () => {
    const error = { body: { error: { code: 'some/other-error' } } };
    onErrorCallback(error);

    const { globalError } = useGlobalError();
    expect(globalError.value).toBeNull();
  });
});
