import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, readonly } from 'vue';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

// Shared spy state for useGlobalError — lets us verify setGlobalError calls
// while sharing the same module-scoped ref that queryClient.js will use.
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
    CONFIG_BASE_URL_MISSING: 'config/base-url-missing',
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

  function isMissingBaseUrlError(error) {
    return getApiErrorCode(error) === API_ERROR_CODES.CONFIG_BASE_URL_MISSING;
  }

  return {
    API_ERROR_CODES,
    getApiErrorCode,
    isMissingBaseUrlError,
    isRosteringEndedError,
    isTerminalAuthError,
  };
});

describe('queryClient QueryCache onError', () => {
  /** @type {Function} */
  let onErrorCallback;

  beforeEach(async () => {
    vi.clearAllMocks();
    globalError.value = null;

    // Pull the onError callback off the live QueryCache config. Same shared
    // useGlobalError ref is used by both the queryClient module and this
    // test, so setGlobalError() effects are observable here.
    const { queryClient } = await import('./queryClient');
    onErrorCallback = queryClient.getQueryCache().config.onError;
  });

  it('sets ROSTERING_ENDED global error on auth/rostering-ended', () => {
    const error = { body: { error: { code: 'auth/rostering-ended' } } };
    onErrorCallback(error);

    expect(setGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
    expect(globalError.value).toEqual({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
  });

  it('sets AUTH_EXPIRED global error on auth/token-expired', () => {
    const error = { body: { error: { code: 'auth/token-expired' } } };
    onErrorCallback(error);

    expect(setGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
    expect(globalError.value).toEqual({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
  });

  it('sets AUTH_EXPIRED global error on auth/required', () => {
    const error = { body: { error: { code: 'auth/required' } } };
    onErrorCallback(error);

    expect(setGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
    expect(globalError.value).toEqual({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
  });

  it('does not set global error for unrecognized error codes', () => {
    const error = { body: { error: { code: 'some/other-error' } } };
    onErrorCallback(error);

    expect(setGlobalError).not.toHaveBeenCalled();
    expect(globalError.value).toBeNull();
  });

  it('sets SERVER_ERROR for a /me query failure', () => {
    const error = { body: { error: { code: 'some/other-error' } } };
    onErrorCallback(error, { queryKey: [ME_QUERY_KEY] });

    expect(setGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
    expect(globalError.value).toEqual({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
  });

  it('does not set SERVER_ERROR for a non-/me query failure', () => {
    const error = { body: { error: { code: 'some/other-error' } } };
    onErrorCallback(error, { queryKey: ['some-other-key'] });

    expect(setGlobalError).not.toHaveBeenCalled();
    expect(globalError.value).toBeNull();
  });

  it('sets SERVER_ERROR on a missing base URL, whichever query surfaced it', () => {
    // A missing base URL breaks every query, so it must not be gated on the
    // /me query key the way an ordinary server error is.
    const error = { code: 'config/base-url-missing' };
    onErrorCallback(error, { queryKey: ['some-other-key'] });

    expect(setGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
    expect(globalError.value).toEqual({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
  });
});

describe('queryClient default retry policy', () => {
  /** @type {Function} */
  let retry;

  beforeEach(async () => {
    vi.clearAllMocks();
    globalError.value = null;

    const { queryClient } = await import('./queryClient');
    retry = queryClient.getDefaultOptions().queries.retry;
  });

  it('does not retry on the missing base URL error class', () => {
    // The base URL is baked in at build time, so it cannot appear between
    // attempts — retrying would only delay the error UI.
    const error = new Error('VITE_ROAR_API_BASE_URL is not set.');
    error.code = 'config/base-url-missing';

    expect(retry(0, error)).toBe(false);
    expect(retry(1, error)).toBe(false);
  });

  it('does not retry on rostering-ended or terminal auth errors', () => {
    expect(retry(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retry(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
  });

  it('still retries transient errors up to 3 times', () => {
    const transientError = new Error('network down');

    expect(retry(0, transientError)).toBe(true);
    expect(retry(2, transientError)).toBe(true);
    expect(retry(3, transientError)).toBe(false);
  });
});
