import * as VueQuery from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, computed, reactive } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';
import NavBar from '../NavBar.vue';
import { ROLES } from '@/constants/roles';

// Define a reactive variable to control the role in tests
const currentTestRole = ref(ROLES.PARTICIPANT);

vi.mock('@/composables/queries/useUserClaimsQuery', () => ({
  default: vi.fn(() => ({
    data: computed(() => ({
      claims: {
        super_admin: currentTestRole.value === ROLES.SUPER_ADMIN,
      },
    })),
  })),
}));

vi.mock('@/composables/useUserType', () => ({
  default: vi.fn(() => ({
    isAdmin: computed(
      () =>
        currentTestRole.value === ROLES.ADMIN ||
        currentTestRole.value === ROLES.SITE_ADMIN ||
        currentTestRole.value === ROLES.SUPER_ADMIN,
    ),
    isSuperAdmin: computed(() => currentTestRole.value === ROLES.SUPER_ADMIN),
  })),
}));

vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({
    userRole: computed(() => currentTestRole.value),
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() =>
    reactive({
      $subscribe: vi.fn(),
      roarfirekit: ref({
        restConfig: true,
      }),
      userData: ref({
        roles: [
          {
            siteId: 'testSite',
            role: currentTestRole.value,
          },
        ],
      }),
      currentSite: ref('testSite'),
      shouldUsePermissions: ref(true),
      firebaseUser: ref({
        adminFirebaseUser: {
          uid: 'test-user-id',
          email: 'test@example.com',
        },
      }),
      isAuthenticated: () => true,
    }),
  ),
}));

vi.mock('../UserActions.vue', () => ({
  default: {
    name: 'UserActions',
    props: ['isBasicView'],
    template: '<div class="user-actions">User Actions</div>',
  },
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
      name: 'ManageAdministrators', // Corrected name to match navbarActions
      component: { template: '<div>manage-administrators</div>' },
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
  currentTestRole.value = ROLES.PARTICIPANT;
  setActivePinia(createPinia());
});

describe('NavBar.vue', () => {
  describe('Role: SUPER_ADMIN', () => {
    beforeEach(() => {
      currentTestRole.value = ROLES.SUPER_ADMIN;
    });

    it('should render all menu items', () => {
      const wrapper = mount(NavBar, mountOptions);
      expect(wrapper.exists()).toBe(true);

      const links = wrapper.findAll('.p-menubar-item-link');
      
      expect(links.length).toBe(9);

      const html = wrapper.html();
      expect(html).toContain('Groups');
      expect(html).toContain('Users');
      expect(html).toContain('Add Users');
      expect(html).toContain('Link Users');
      expect(html).toContain('Manage Administrators');
      expect(html).toContain('Assignments');
      expect(html).toContain('View Assignments');
      expect(html).toContain('Create Assignment');
      expect(html).toContain('Manage Tasks');

      expect(wrapper.vm.computedIsBasicView).toBe(false);
    });
  });

  describe('Role: SITE_ADMIN', () => {
    beforeEach(() => {
      currentTestRole.value = ROLES.SITE_ADMIN;
    });

    it('should render site admin menu items (same as admin)', () => {
      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');

      // Same as ADMIN
      expect(links.length).toBe(8);
      expect(wrapper.html()).not.toContain('Manage Tasks');
    });
  });

  describe('Role: ADMIN', () => {
    beforeEach(() => {
      currentTestRole.value = ROLES.ADMIN;
    });

    it('should render admin menu items', () => {
      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');

      expect(links.length).toBe(8);

      const html = wrapper.html();
      expect(html).toContain('Groups');
      expect(html).toContain('Users');
      expect(html).toContain('Add Users');
      expect(html).toContain('Link Users');
      expect(html).toContain('Manage Administrators');
      expect(html).toContain('Assignments');
      expect(html).toContain('View Assignments');
      expect(html).toContain('Create Assignment');
      
      expect(html).not.toContain('Manage Tasks');
    });
  });

  describe('Role: RESEARCH_ASSISTANT', () => {
    beforeEach(() => {
      currentTestRole.value = ROLES.RESEARCH_ASSISTANT;
    });

    it('should render research assistant menu items', () => {
      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');

      expect(links.length).toBe(7);

      const html = wrapper.html();
      expect(html).toContain('Groups');
      expect(html).toContain('Users');
      expect(html).toContain('Add Users');
      expect(html).toContain('Link Users');
      expect(html).toContain('Manage Administrators');
      expect(html).toContain('Assignments');
      expect(html).toContain('View Assignments');
      
      expect(html).not.toContain('Create Assignment');
      expect(html).not.toContain('Manage Tasks');
    });
  });

  describe('Role: PARTICIPANT', () => {
    beforeEach(() => {
      currentTestRole.value = ROLES.PARTICIPANT;
    });

    it('should render no menu items', () => {
      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');

      expect(links.length).toBe(0);
      expect(wrapper.vm.computedIsBasicView).toBe(true);
    });
  });
});
