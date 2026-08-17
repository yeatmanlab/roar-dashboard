import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markRaw } from 'vue';
import { useAuthStore } from '@/store/auth';

const mocks = vi.hoisted(() => ({
  fetchDocById: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    replace: mocks.routerReplace,
  }),
}));

vi.mock('@/services/AuthService', () => ({
  getAuthService: () => ({
    isSignInWithEmailLink: mocks.isSignInWithEmailLink,
  }),
}));

vi.mock('@/helpers/query/utils', () => ({
  fetchDocById: mocks.fetchDocById,
}));

import AuthEmailLink from './AuthEmailLink.vue';

const email = 'reader@example.com';

function createFirekitSpy() {
  const firekit = {};
  const isSignInWithEmailLink = vi.fn(() => vi.fn());
  const signInWithEmailLink = vi.fn(() => vi.fn());

  Object.defineProperty(firekit, 'isSignInWithEmailLink', {
    get: isSignInWithEmailLink,
  });
  Object.defineProperty(firekit, 'signInWithEmailLink', {
    get: signInWithEmailLink,
  });

  return {
    firekit: markRaw(firekit),
    getters: {
      isSignInWithEmailLink,
      signInWithEmailLink,
    },
  };
}

function mountAuthEmailLink({ signInWithEmailLink: signInWithEmailLinkImplementation = vi.fn() } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const authStore = useAuthStore();
  const firekitSpy = createFirekitSpy();
  authStore.roarfirekit = firekitSpy.firekit;
  const signInWithEmailLink = vi
    .spyOn(authStore, 'signInWithEmailLink')
    .mockImplementation((...args) => signInWithEmailLinkImplementation(authStore, ...args));

  const wrapper = mount(AuthEmailLink, {
    global: {
      plugins: [pinia],
      stubs: {
        AppSpinner: { template: '<div data-testid="spinner" />' },
        PvButton: { props: ['label'], template: '<button type="button">{{ label }}</button>' },
        PvFloatLabel: { template: '<label><slot /></label>' },
        PvInputText: { template: '<input />' },
      },
    },
  });

  return { authStore, firekitSpy, signInWithEmailLink, wrapper };
}

describe('AuthEmailLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
    window.history.pushState({}, '', '/auth-email-link?mode=signIn&oobCode=test-code');
    mocks.isSignInWithEmailLink.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('completes a stored-email link through the store action and routes home', async () => {
    window.localStorage.setItem('emailForSignIn', email);
    const { signInWithEmailLink, wrapper } = mountAuthEmailLink({
      signInWithEmailLink: async (authStore) => {
        authStore.accessToken = 'signed-in-token';
      },
    });

    try {
      await flushPromises();

      expect(mocks.isSignInWithEmailLink).toHaveBeenCalledWith(window.location.href);
      expect(signInWithEmailLink).toHaveBeenCalledWith({
        email,
        emailLink: window.location.href,
      });
      expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'Home' });
    } finally {
      wrapper.unmount();
    }
  });

  it('routes invalid action codes back to sign-in', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem('emailForSignIn', email);
    const { wrapper } = mountAuthEmailLink({
      signInWithEmailLink: async () => {
        throw { code: 'auth/invalid-action-code' };
      },
    });

    try {
      await flushPromises();

      expect(mocks.routerReplace).not.toHaveBeenCalledWith({ name: 'SignIn' });

      vi.advanceTimersByTime(5000);

      expect(mocks.routerReplace).toHaveBeenCalledWith({ name: 'SignIn' });
    } finally {
      wrapper.unmount();
    }
  });

  it('does not use firekit or Firestore while completing the email link', async () => {
    window.localStorage.setItem('emailForSignIn', email);
    const { firekitSpy, wrapper } = mountAuthEmailLink({
      signInWithEmailLink: async (authStore) => {
        authStore.accessToken = 'signed-in-token';
      },
    });

    try {
      await flushPromises();

      expect(firekitSpy.getters.isSignInWithEmailLink).not.toHaveBeenCalled();
      expect(firekitSpy.getters.signInWithEmailLink).not.toHaveBeenCalled();
      expect(mocks.fetchDocById).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });
});
