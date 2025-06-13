import * as VueQuery from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';
import NavBar from '../NavBar.vue';

let mockIsUserAdmin = true;
let mockIsUserSuperAdmin = true;

vi.mock('@/composables/queries/useUserClaimsQuery', () => ({
  default: vi.fn(() => ({
    data: ref({
      //
    }),
  })),
}));

vi.mock('@/composables/useUserType', () => ({
  default: vi.fn(() => ({
    isAdmin: ref(mockIsUserAdmin),
    isSuperAdmin: ref(mockIsUserSuperAdmin),
  })),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() => ({
    $subscribe: vi.fn(),
    isUserAdmin: mockIsUserAdmin,
    roarfirekit: ref({
      restConfig: true,
    }),
  })),
}));

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      navBar: {
        signOut: 'Sign Out',
      },
    },
  },
});

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'Home', component: { template: '<div>assignments</div>' } },
    { path: '/list-groups', name: 'ListGroups', component: { template: '<div>list-groups</div>' } },
    { path: '/add-users', name: 'Add Users', component: { template: '<div>add-users</div>' } },
    { path: '/link-users', name: 'Link Users', component: { template: '<div>link-users</div>' } },
    {
      path: '/create-administrator',
      name: 'CreateAdministrator',
      component: { template: '<div>create-administrator</div>' },
    },
    { path: '/create-assignment', name: 'CreateAssignment', component: { template: '<div>create-assignment</div>' } },
    {
      path: '/manage-tasks-variants',
      name: 'ManageTasksVariants',
      component: { template: '<div>manage-tasks-variants</div>' },
    },
  ],
});

const mountOptions = {
  global: {
    plugins: [i18n, PrimeVue, router, VueQuery.VueQueryPlugin],
  },
};

beforeEach(async () => {
  mockIsUserAdmin = true;
  mockIsUserSuperAdmin = true;
  setActivePinia(createPinia());
});

describe('NavBar.vue', () => {
  describe('User type: admin', () => {
    it('should render the component', () => {
      const wrapper = mount(NavBar, mountOptions);
      expect(wrapper.exists()).toBe(true);

      const links = wrapper.findAll('.p-menubar-item-link');
      expect(links.length).toBe(9);

      // If false, the help dropdown with Report an Issue option is displayed
      expect(wrapper.vm.computedIsBasicView).toBe(false);
    });

    it('should display the menu accordingly to user type', async () => {
      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');

      expect(links.length).toBe(9);
      expect(links[0].html()).toContain('Groups');
      expect(links[1].html()).toContain('Users');
      expect(links[2].html()).toContain('Add Users');
      expect(links[3].html()).toContain('Link Users');
      expect(links[4].html()).toContain('Register administrator');
      expect(links[5].html()).toContain('Assignments');
      expect(links[6].html()).toContain('View Assignments');
      expect(links[7].html()).toContain('Create Assignment');
      expect(links[8].html()).toContain('Manage Tasks');
    });
  });

  describe('User type: non-admin', () => {
    it('should render the component', () => {
      mockIsUserAdmin = false;

      const wrapper = mount(NavBar, mountOptions);
      expect(wrapper.exists()).toBe(true);

      const links = wrapper.findAll('.p-menubar-item-link');
      expect(links.length).toBe(7);

      // If false, the help dropdown with Report an Issue option is displayed
      expect(wrapper.vm.computedIsBasicView).toBe(false);
    });

    it('should display the menu accordingly to user type', async () => {
      mockIsUserAdmin = false;

      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');

      expect(links.length).toBe(7);
      expect(links[0].html()).toContain('Users');
      expect(links[1].html()).toContain('Add Users');
      expect(links[2].html()).toContain('Link Users');
      expect(links[3].html()).toContain('Register administrator');
      expect(links[4].html()).toContain('Assignments');
      expect(links[5].html()).toContain('Create Assignment');
      expect(links[6].html()).toContain('Manage Tasks');
    });
  });

  describe('User type: non-admin & non-superAdmin', () => {
    it('should render the component', () => {
      mockIsUserAdmin = false;
      mockIsUserSuperAdmin = false;

      const wrapper = mount(NavBar, mountOptions);
      expect(wrapper.exists()).toBe(true);

      const links = wrapper.findAll('.p-menubar-item-link');
      expect(links.length).toBe(0);

      // If false, the help dropdown with Report an Issue option is displayed
      expect(wrapper.vm.computedIsBasicView).toBe(true);
    });
  });
});
