import * as VueQuery from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import ListGroups from '../groups/ListGroups.vue';

const routerPush = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
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
  })),
}));

vi.mock('@/composables/queries/useUserClaimsQuery', () => ({
  default: () => ({
    data: {
      value: {
        claims: {
          //
        },
      },
    },
  }),
}));

beforeEach(() => {
  setActivePinia(createPinia());
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
    const tabHeaders = wrapper.findAll('.p-tabview-tablist-item');
    const table = wrapper.find('[data-cy="roar-data-table"]');

    expect(addGroupBtn.exists()).toBe(true);
    expect(addUsersBtn.exists()).toBe(true);
    expect(tabHeaders.length).toBe(4);
    expect(table.exists()).toBe(true);
  });

  it('should allow users to navigate through all the tabs', async () => {
    const wrapper = mount(ListGroups, mountOptions);
    const tabHeaders = wrapper.findAll('.p-tabview-tablist-item');

    expect(tabHeaders.length).toBe(4);

    for (let i = 0; i < tabHeaders.length; i++) {
      const tabHeaderLink = tabHeaders[i].find('a');
      await tabHeaderLink.trigger('click');
      expect(tabHeaders[i].classes()).toContain('p-tabview-tablist-item-active');
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
