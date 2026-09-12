import { shallowMount, RouterLinkStub } from '@vue/test-utils';
import { ref, reactive, nextTick } from 'vue';
import AdminProfile from './AdminProfile.vue';

const currentUser = ref();
const authStore = reactive({ firebaseUser: null });
vi.mock('@/composables/useCurrentUser', () => ({ default: () => ({ data: currentUser }) }));
vi.mock('@/store/auth', () => ({ useAuthStore: () => authStore }));
const mountProfile = () =>
  shallowMount(AdminProfile, {
    global: { stubs: { RouterLink: RouterLinkStub, RouterView: true } },
  });

describe('AdminProfile', () => {
  it.each(['admin', 'educator', 'super-admin', 'student', 'caregiver', undefined])(
    'uses /me identity for %s profile links without legacy claims',
    async (userType) => {
      currentUser.value = userType && { userType, isSuperAdmin: userType === 'super-admin' };
      authStore.firebaseUser = null;
      const wrapper = mountProfile();
      const isAdmin = ['admin', 'educator', 'super-admin'].includes(userType);
      expect(wrapper.findAllComponents(RouterLinkStub).length).toBe(isAdmin ? 4 : 1);
      wrapper.unmount();
    },
  );

  it('updates password and profile links from the current Firebase user and /me', async () => {
    currentUser.value = { userType: 'admin', isSuperAdmin: false };
    authStore.firebaseUser = null;
    const wrapper = mountProfile();
    expect(wrapper.text()).toContain('Add Password');
    authStore.firebaseUser = { providerData: [{ providerId: 'password' }] };
    await nextTick();
    expect(wrapper.text()).toContain('Change Password');
    currentUser.value = { userType: 'student', isSuperAdmin: false };
    await nextTick();
    expect(wrapper.text()).not.toContain('Link Accounts');
    wrapper.unmount();
  });
});
