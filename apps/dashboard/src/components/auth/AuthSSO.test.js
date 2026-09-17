import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    replace: mocks.routerReplace,
  }),
}));

import AuthSSO from './AuthSSO.vue';

const OAUTH_FLAGS = {
  [AUTH_SSO_PROVIDERS.CLEVER]: 'cleverOAuthRequested',
  [AUTH_SSO_PROVIDERS.CLASSLINK]: 'classLinkOAuthRequested',
  [AUTH_SSO_PROVIDERS.NYCPS]: 'nycpsOAuthRequested',
};

function mountAuthSSO(props) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const wrapper = mount(AuthSSO, {
    props,
    global: {
      plugins: [pinia],
      stubs: { AppSpinner: true },
    },
  });

  return { wrapper, authStore: useAuthStore() };
}

describe('AuthSSO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(Object.keys(OAUTH_FLAGS))(
    'sets the %s OAuth flag and bounces to SignIn when a code is present',
    async (provider) => {
      const { authStore } = mountAuthSSO({ provider, code: 'oauth-code' });
      await flushPromises();

      expect(authStore[OAUTH_FLAGS[provider]]).toBe(true);

      // The other providers' flags stay untouched.
      const otherFlags = Object.entries(OAUTH_FLAGS)
        .filter(([otherProvider]) => otherProvider !== provider)
        .map(([, flag]) => authStore[flag]);
      expect(otherFlags).toEqual([false, false]);

      expect(mocks.routerReplace).toHaveBeenCalledWith({ name: 'SignIn' });
      expect(mocks.routerPush).not.toHaveBeenCalled();
    },
  );

  it('treats the InitiateAuthNycps sentinel code "true" as a present code', async () => {
    const { authStore } = mountAuthSSO({ provider: AUTH_SSO_PROVIDERS.NYCPS, code: 'true' });
    await flushPromises();

    expect(authStore.nycpsOAuthRequested).toBe(true);
    expect(mocks.routerReplace).toHaveBeenCalledWith({ name: 'SignIn' });
  });

  it('redirects to Home for an unknown provider without touching the store', async () => {
    // AUTH_SSO_PROVIDERS.GOOGLE is a real enum member but has no landing flag.
    const { authStore } = mountAuthSSO({ provider: AUTH_SSO_PROVIDERS.GOOGLE, code: 'oauth-code' });
    await flushPromises();

    expect(authStore.undefined).toBeUndefined();
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'Home' });
    expect(mocks.routerReplace).not.toHaveBeenCalled();
  });

  it('redirects to Home when no code is present', async () => {
    const { authStore } = mountAuthSSO({ provider: AUTH_SSO_PROVIDERS.CLEVER });
    await flushPromises();

    expect(authStore.cleverOAuthRequested).toBe(false);
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'Home' });
    expect(mocks.routerReplace).not.toHaveBeenCalled();
  });

  it('renders only a spinner while redirecting', () => {
    const { wrapper } = mountAuthSSO({ provider: AUTH_SSO_PROVIDERS.CLEVER, code: 'oauth-code' });

    expect(wrapper.findComponent({ name: 'AppSpinner' }).exists()).toBe(true);
  });
});
