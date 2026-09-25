import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, nextTick } from 'vue';

const mockReplace = vi.fn();
const mockRoute = { name: 'Home' };

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ replace: mockReplace }),
}));

import { useGlobalErrorRedirect } from './useGlobalErrorRedirect';
import { useGlobalError } from './useGlobalError';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';
import { APP_ROUTE_NAMES } from '@/constants/routes';

const { globalError, setGlobalError, clearGlobalError } = useGlobalError();

describe('useGlobalErrorRedirect', () => {
  let scope;

  const install = () => scope.run(() => useGlobalErrorRedirect());

  beforeEach(() => {
    vi.clearAllMocks();
    clearGlobalError();
    mockRoute.name = 'Home';
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  // The core regression from review: `setGlobalError` alone doesn't navigate,
  // and the router guard only runs on navigations. A Firekit init failure
  // after the initial route has settled must still reach the error page.
  it('redirects to GenericError when SERVER_ERROR is set after the route has settled', async () => {
    install();
    expect(mockReplace).not.toHaveBeenCalled();

    setGlobalError({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
    await nextTick();

    expect(mockReplace).toHaveBeenCalledWith({ name: APP_ROUTE_NAMES.GENERIC_ERROR });
  });

  it('redirects to AccessEnded on ROSTERING_ENDED', async () => {
    install();

    setGlobalError({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
    await nextTick();

    expect(mockReplace).toHaveBeenCalledWith({ name: APP_ROUTE_NAMES.ACCESS_ENDED });
  });

  it('clears the error and redirects to SignIn on AUTH_EXPIRED', async () => {
    install();

    setGlobalError({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
    await nextTick();

    // Cleared before redirecting — mirrors the router guard — so the guard
    // doesn't bounce the user back to SignIn after a successful sign-in.
    expect(globalError.value).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith({ name: APP_ROUTE_NAMES.SIGN_IN });
  });

  it('does not redirect when already on the target route', async () => {
    mockRoute.name = APP_ROUTE_NAMES.GENERIC_ERROR;
    install();

    setGlobalError({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
    await nextTick();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('handles an error set before the watcher was installed (immediate)', async () => {
    setGlobalError({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
    install();
    await nextTick();

    expect(mockReplace).toHaveBeenCalledWith({ name: APP_ROUTE_NAMES.GENERIC_ERROR });
  });

  it('does nothing while no error is set', async () => {
    install();
    await nextTick();

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
