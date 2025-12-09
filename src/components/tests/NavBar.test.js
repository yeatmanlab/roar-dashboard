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
import { getNavbarActions } from '@/router/navbarActions';

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

const countMenuLinks = (menuItems = []) => {
  const stack = [...menuItems];
  let count = 0;
  while (stack.length) {
    const item = stack.pop();
    count += 1;
    if (item.items && item.items.length) {
      stack.push(...item.items);
    }
  }
  return count;
};

const buildMenuLabels = (actions = []) => {
  const labels = [];
  const groupsAction = actions.find((action) => action.category === 'Groups');
  if (groupsAction) {
    labels.push(groupsAction.title);
  }

  const headers = ['Users', 'Assignments'];
  headers.forEach((header) => {
    const headerItems = actions.filter((action) => action.category === header);
    if (headerItems.length) {
      labels.push(header);
      headerItems.forEach((action) => labels.push(action.title));
    }
  });

  return labels;
};

const allMenuLabels = buildMenuLabels(getNavbarActions({ userRole: ROLES.SUPER_ADMIN }));

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
      const expectedLinkCount = countMenuLinks(wrapper.vm.computedItems);
      const visibleLabels = buildMenuLabels(getNavbarActions({ userRole: currentTestRole.value }));
      // routes the user should not have access to based on their role
      const hiddenLabels = allMenuLabels.filter((label) => !visibleLabels.includes(label));

      expect(links.length).toBe(expectedLinkCount);

      const html = wrapper.html();
      visibleLabels.forEach((label) => expect(html).toContain(label));
      hiddenLabels.forEach((label) => expect(html).not.toContain(label));

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
      const visibleLabels = buildMenuLabels(getNavbarActions({ userRole: currentTestRole.value }));
      const hiddenLabels = allMenuLabels.filter((label) => !visibleLabels.includes(label));

      expect(links.length).toBe(countMenuLinks(wrapper.vm.computedItems));
      visibleLabels.forEach((label) => expect(wrapper.html()).toContain(label));
      hiddenLabels.forEach((label) => expect(wrapper.html()).not.toContain(label));
    });
  });

  describe('Role: ADMIN', () => {
    beforeEach(() => {
      currentTestRole.value = ROLES.ADMIN;
    });

    it('should render admin menu items', () => {
      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');
      const visibleLabels = buildMenuLabels(getNavbarActions({ userRole: currentTestRole.value }));
      const hiddenLabels = allMenuLabels.filter((label) => !visibleLabels.includes(label));

      expect(links.length).toBe(countMenuLinks(wrapper.vm.computedItems));

      const html = wrapper.html();
      visibleLabels.forEach((label) => expect(html).toContain(label));
      hiddenLabels.forEach((label) => expect(html).not.toContain(label));
    });
  });

  describe('Role: RESEARCH_ASSISTANT', () => {
    beforeEach(() => {
      currentTestRole.value = ROLES.RESEARCH_ASSISTANT;
    });

    it('should render research assistant menu items', () => {
      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');
      const visibleLabels = buildMenuLabels(getNavbarActions({ userRole: currentTestRole.value }));
      const hiddenLabels = allMenuLabels.filter((label) => !visibleLabels.includes(label));

      expect(links.length).toBe(countMenuLinks(wrapper.vm.computedItems));

      const html = wrapper.html();
      visibleLabels.forEach((label) => expect(html).toContain(label));
      hiddenLabels.forEach((label) => expect(html).not.toContain(label));
    });
  });

  describe('Role: PARTICIPANT', () => {
    beforeEach(() => {
      currentTestRole.value = ROLES.PARTICIPANT;
    });

    it('should render no menu items', () => {
      const wrapper = mount(NavBar, mountOptions);
      const links = wrapper.findAll('.p-menubar-item-link');
      const visibleLabels = buildMenuLabels(getNavbarActions({ userRole: currentTestRole.value }));
      const hiddenLabels = allMenuLabels.filter((label) => !visibleLabels.includes(label));

      expect(links.length).toBe(countMenuLinks(wrapper.vm.computedItems));
      expect(wrapper.vm.computedIsBasicView).toBe(true);
      const html = wrapper.html();
      visibleLabels.forEach((label) => expect(html).toContain(label));
      hiddenLabels.forEach((label) => expect(html).not.toContain(label));
    });
  });
});
