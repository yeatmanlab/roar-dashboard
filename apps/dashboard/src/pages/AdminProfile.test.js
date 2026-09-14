import { shallowMount, RouterLinkStub } from '@vue/test-utils';
import { ref, reactive, nextTick } from 'vue';
import AdminProfile from './AdminProfile.vue';

const usesAdminProfile = ref(false);
const authStore = reactive({ hasPasswordProvider: false });
vi.mock('@/composables/useCurrentUser', () => ({ default: () => ({ usesAdminProfile }) }));
vi.mock('@/store/auth', () => ({ useAuthStore: () => authStore }));
const mountProfile = () =>
  shallowMount(AdminProfile, {
    global: { stubs: { RouterLink: RouterLinkStub, RouterView: true } },
  });

describe('AdminProfile', () => {
  it.each([true, false])('uses the admin profile classification for profile links: %s', async (expected) => {
    usesAdminProfile.value = expected;
    authStore.hasPasswordProvider = false;
    const wrapper = mountProfile();
    expect(wrapper.findAllComponents(RouterLinkStub).length).toBe(expected ? 4 : 1);
    wrapper.unmount();
  });

  it('updates password and profile links from the current Firebase user and /me', async () => {
    usesAdminProfile.value = true;
    authStore.hasPasswordProvider = false;
    const wrapper = mountProfile();
    expect(wrapper.text()).toContain('Add Password');
    authStore.hasPasswordProvider = true;
    await nextTick();
    expect(wrapper.text()).toContain('Change Password');
    usesAdminProfile.value = false;
    await nextTick();
    expect(wrapper.text()).not.toContain('Link Accounts');
    wrapper.unmount();
  });
});
