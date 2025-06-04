import * as VueQuery from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import CreateAssignment from '../CreateAssignment.vue';

const mockUpsertAdministration = vi.fn();

vi.mock('@/composables/mutations/useUpsertAdministrationMutation', () => {
  return {
    default: () => ({
      mutate: mockUpsertAdministration,
      isPending: false,
      error: null,
    }),
  };
});

vi.mock('@/composables/queries/useUserClaimsQuery', () => ({
  default: vi.fn(() => ({
    data: ref({
      //
    }),
  })),
}));

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn(),
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

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('Create Assignment Page', () => {
  it('should render the page', () => {
    const wrapper = mount(CreateAssignment, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
        stubs: { GroupPicker: true },
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should show an error if a required field is not filled in', async () => {
    const wrapper = mount(CreateAssignment, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
        stubs: { GroupPicker: true },
      },
    });

    const submitBtn = wrapper.find('[data-cy="button-create-administration"]');

    // The submit button should be disabled by default
    expect(submitBtn.exists()).toBe(true);
    expect(submitBtn.attributes('disabled')).toBe('');

    wrapper.vm.state.administrationName = 'Assignment Name';

    await wrapper.vm.$nextTick();

    // After setting a name, the button should NOT have the disabled attr anymore
    expect(submitBtn.attributes('disabled')).toBe(undefined);

    await wrapper.vm.submit();

    const errorMessages = wrapper.findAll('.p-error');

    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it('should submit the form if everything is ok', async () => {
    const wrapper = mount(CreateAssignment, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
        stubs: { GroupPicker: true },
      },
    });

    const assignmentName = 'Assignment Name';
    const dateStarted = '2025-05-30';
    const dateClosed = '2025-05-31';
    const districts = [
      {
        schools: ['3Xtxp98rBmtJfp0I8Gsl'],
        name: 'A Test Site',
        id: 'ym6s50BHi6B5nYCKGGWH',
      },
    ];
    const schools = [];
    const classes = [];
    const groups = [];
    const families = [];

    wrapper.vm.state.administrationName = assignmentName;
    wrapper.vm.state.dateStarted = dateStarted;
    wrapper.vm.state.dateClosed = dateClosed;
    wrapper.vm.state.districts = districts;
    wrapper.vm.state.schools = schools;
    wrapper.vm.state.classes = classes;
    wrapper.vm.state.groups = groups;
    wrapper.vm.state.families = families;

    wrapper.vm.state.sequential = true;
    wrapper.vm.state.legal = {
      consent: null,
      assent: null,
      amount: '',
      expectedTime: '',
    };

    wrapper.vm.variants = [
      {
        id: 'YXXjBbBuaacSaEV4NGiW',
        variant: {
          params: {
            storeItemId: false,
            maxTime: 100,
            sequentialStimulus: true,
            numberOfTrials: 300,
            keyHelpers: false,
            stimulusBlocks: 3,
            corpus: null,
            numOfPracticeTrials: 2,
            maxIncorrect: 3,
            language: 'en',
            sequentialPractice: true,
            skipInstructions: true,
            taskName: 'intro',
            buttonLayout: 'default',
            age: null,
          },
          name: 'en',
          registered: true,
          lastUpdated: '2025-05-15T20:12:54.288Z',
          id: 'YXXjBbBuaacSaEV4NGiW',
          parentDoc: 'intro',
          conditions: {
            assigned: {
              op: 'AND',
              conditions: [
                {
                  field: 'userType',
                  op: 'EQUAL',
                  value: 'student',
                },
              ],
            },
          },
        },
        task: {
          id: 'intro',
          name: 'Instructions',
          registered: true,
          description: 'Learn how to play our games!',
          image: 'https://storage.googleapis.com/road-dashboard/shared/intro-logo.png',
          lastUpdated: '2025-05-30T15:17:44.859Z',
        },
      },
    ];

    await wrapper.vm.submit();
    await wrapper.vm.$nextTick();

    const errorMessages = wrapper.findAll('.p-error');

    expect(errorMessages.length).toBe(0);
    expect(mockUpsertAdministration).toHaveBeenCalledTimes(1);
  });
});
