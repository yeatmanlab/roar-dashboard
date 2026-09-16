import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const mockPush = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockClearGlobalError = vi.fn();
const mockSignOut = vi.fn();
const authStore = { roarfirekit: null, initFirekit: vi.fn().mockResolvedValue(undefined) };

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock('@tanstack/vue-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }));
vi.mock('@/store/auth', () => ({ useAuthStore: () => authStore }));
vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({ clearGlobalError: mockClearGlobalError }),
}));
vi.mock('@/composables/mutations/useSignOutMutation', () => ({ default: () => ({ mutate: mockSignOut }) }));

import GenericError from './GenericError.vue';

const mountPage = () =>
  mount(GenericError, {
    global: {
      stubs: {
        // Render a plain button so `label` shows and clicks pass through.
        PvButton: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}</button>' },
      },
    },
  });

const clickTryAgain = async (wrapper) => {
  const button = wrapper.findAll('button').find((b) => b.text() === 'Try Again');
  await button.trigger('click');
  await flushPromises();
};

describe('GenericError.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.roarfirekit = null;
  });

  // SERVER_ERROR can mean the app-bootstrap initFirekit() failed; nothing on
  // the SPA navigation path re-runs it, so Try Again must — otherwise the user
  // re-enters the app with roarfirekit still null.
  it('re-runs initFirekit on Try Again when firekit never initialized', async () => {
    const wrapper = mountPage();
    await clickTryAgain(wrapper);

    expect(mockClearGlobalError).toHaveBeenCalled();
    expect(authStore.initFirekit).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: expect.any(Array) });
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('skips the firekit re-init when it is already up', async () => {
    authStore.roarfirekit = { initialized: true };
    const wrapper = mountPage();
    await clickTryAgain(wrapper);

    expect(authStore.initFirekit).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
