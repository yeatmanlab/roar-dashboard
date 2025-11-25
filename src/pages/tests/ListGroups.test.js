import * as VueQuery from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import ListGroups from '../groups/ListGroups.vue';

const routerPush = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
    currentRoute: ref({
      name: 'ListGroups',
      path: '/list-groups',
      fullPath: '/list-groups',
    }),
  }),
}));

vi.mock('@bdelab/roar-utils', () => ({
  default: {
    //
  },
}));

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    //
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() => ({
    $subscribe: vi.fn(),
    roarfirekit: ref({
      restConfig: true,
    }),
    isUserSuperAdmin: vi.fn(() => true),
    currentSite: ref('test-site'),
    shouldUsePermissions: ref(false),
    userClaims: ref({
      claims: {
        adminOrgs: {
          districts: [],
          schools: [],
          classes: [],
          groups: [],
          families: [],
        },
      },
    }),
  })),
}));

vi.mock('@/composables/queries/useUserClaimsQuery', () => ({
  default: () => ({
    data: ref({
      claims: {
        adminOrgs: {
          districts: [],
          schools: [],
          classes: [],
          groups: [],
          families: [],
        },
      },
    }),
  }),
}));

vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({
    can: vi.fn(() => true),
    canGlobal: vi.fn(() => true),
    hasRole: vi.fn(() => true),
    hasMinimumRole: vi.fn(() => true),
    userRole: ref('siteAdmin'),
    permissions: ref({}),
    permissionsLoaded: ref(true),
  }),
}));

vi.mock('@/composables/queries/_useDistrictsQuery', () => ({
  default: () => ({
    data: ref([]),
    isLoading: ref(false),
  }),
}));

vi.mock('@/composables/queries/_useSchoolsQuery', () => ({
  default: () => ({
    data: ref([]),
    isLoading: ref(false),
  }),
}));

// Mock query composables
vi.mock('@/composables/queries/useDistrictsListQuery', () => ({
  default: () => ({
    isLoading: ref(false),
    data: ref([]),
  }),
}));

vi.mock('@/composables/queries/useDistrictSchoolsQuery', () => ({
  default: () => ({
    isLoading: ref(false),
    data: ref([]),
  }),
}));

vi.mock('@/composables/queries/useOrgsTableQuery', () => ({
  default: () => ({
    isLoading: ref(false),
    isFetching: ref(false),
    data: ref([]),
    isError: ref(false),
    error: ref(null),
  }),
}));

vi.mock('@/composables/queries/useAdministrationsListQuery', () => ({
  useFullAdministrationsListQuery: () => ({
    isLoading: ref(false),
    isFetching: ref(false),
    data: ref([]),
    isError: ref(false),
    error: ref(null),
  }),
}));

vi.mock('@/components/PermissionGuard.vue', () => ({
  default: {
    name: 'PermissionGuard',
    template: '<div class="permission-guard"><slot /></div>',
  },
}));

vi.mock('@/components/EditOrgsForm.vue', () => ({
  default: {
    name: 'EditOrgsForm',
    template: '<div class="edit-orgs-form">Edit Orgs Form</div>',
  },
}));

vi.mock('@/components/modals/RoarModal.vue', () => ({
  default: {
    name: 'RoarModal',
    template: '<div class="roar-modal"><slot /></div>',
  },
}));

vi.mock('@/components/RoarDataTable.vue', () => ({
  default: {
    name: 'RoarDataTable',
    template: '<div class="roar-data-table" data-cy="roar-data-table">Data Table</div>',
  },
}));

vi.mock('@/components/modals/AddGroupModal.vue', () => ({
  default: {
    name: 'AddGroupModal',
    template: '<div class="add-group-modal">Add Group Modal</div>',
  },
}));

vi.mock('@/components/modals/GroupAssignmentsModal.vue', () => ({
  default: {
    name: 'GroupAssignmentsModal',
    template: '<div class="group-assignments-modal">Group Assignments Modal</div>',
  },
}));

beforeEach(() => {
  setActivePinia(createPinia());
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

const mountOptions = {
  global: {
    directives: {
      tooltip: () => {},
    },
    plugins: [VueQuery.VueQueryPlugin, PrimeVue],
    stubs: {
      RouterLink: true,
    },
  },
};

describe('ListGroups.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(ListGroups, mountOptions);

    const addGroupBtn = wrapper.find('[data-testid="add-group-btn"]');
    const addUsersBtn = wrapper.find('[data-testid="add-users-btn"]');
    // Updated selector for new PrimeVue Tabs component
    const tabHeaders = wrapper.findAll('.p-tab');
    const table = wrapper.find('[data-cy="roar-data-table"]');

    expect(addGroupBtn.exists()).toBe(true);
    expect(addUsersBtn.exists()).toBe(true);
    expect(tabHeaders.length).toBe(4);
    expect(table.exists()).toBe(true);
  });

  it('should allow users to navigate through all the tabs', async () => {
    const wrapper = mount(ListGroups, mountOptions);
    // Updated selector for new PrimeVue Tabs component
    const tabHeaders = wrapper.findAll('.p-tab');

    expect(tabHeaders.length).toBe(4);

    for (let i = 0; i < tabHeaders.length; i++) {
      await tabHeaders[i].trigger('click');
      // Updated active class for new PrimeVue Tabs component
      expect(tabHeaders[i].classes()).toContain('p-tab-active');
    }
  });

  it('should turn AddGroupModal visible after clicking Add Group button', () => {
    const wrapper = mount(ListGroups, mountOptions);
    const addGroupBtn = wrapper.find('[data-testid="add-group-btn"]');

    expect(addGroupBtn.exists()).toBe(true);
    expect(wrapper.vm.isAddGroupModalVisible).toBe(false);

    addGroupBtn.trigger('click');
    expect(wrapper.vm.isAddGroupModalVisible).toBe(true);
  });

  it('should redirect users to the page for creating users', () => {
    const wrapper = mount(ListGroups, mountOptions);
    const addUsersBtn = wrapper.find('[data-testid="add-users-btn"]');

    expect(addUsersBtn.exists()).toBe(true);

    addUsersBtn.trigger('click');

    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith({ name: 'Add Users' });
  });
});
