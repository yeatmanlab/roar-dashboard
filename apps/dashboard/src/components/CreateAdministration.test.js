import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createPinia, setActivePinia, defineStore } from 'pinia';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import { ADMINISTRATION_FORM_TYPES } from '@/constants/routes';

// Reached transitively via @/helpers/reports. The published package imports './utils' without a
// file extension, which Vite cannot resolve as ESM.
vi.mock('@bdelab/roar-utils', () => ({
  getGrade: vi.fn((grade) => parseInt(grade, 10)),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({
    userCan: () => true,
    Permissions: { Administrations: { CREATE: 'administrations.create', UPDATE: 'administrations.update' } },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: defineStore('authStore', {
    state: () => ({ roarfirekit: { restConfig: () => true } }),
  }),
}));

vi.mock('@/composables/mutations/useUpsertAdministrationMutation', () => ({
  default: () => ({ mutate: vi.fn(), isPending: ref(false) }),
}));

// The two queries whose refetches drive the hydration watcher.
const administrationData = ref(undefined);
const allVariants = ref([]);

vi.mock('@/composables/queries/useAdministrationsQuery', () => ({
  default: () => ({ data: administrationData }),
}));
vi.mock('@/composables/queries/useTaskVariantsQuery', () => ({
  default: () => ({ data: allVariants, refetch: vi.fn() }),
}));
vi.mock('@/composables/queries/useTaskBundlesQuery', () => ({
  default: () => ({ data: ref([]) }),
}));
vi.mock('@/composables/queries/useDistrictsQuery', () => ({ default: () => ({ data: ref([]) }) }));
vi.mock('@/composables/queries/useSchoolsQuery', () => ({ default: () => ({ data: ref([]) }) }));
vi.mock('@/composables/queries/useClassesQuery', () => ({ default: () => ({ data: ref([]) }) }));
vi.mock('@/composables/queries/useGroupsQuery', () => ({ default: () => ({ data: ref([]) }) }));
vi.mock('@/composables/queries/useFamiliesQuery', () => ({ default: () => ({ data: ref([]) }) }));

const ADMINISTRATION_ID = 'administration-1';

const makeVariant = (id, taskId) => ({
  id,
  task: { id: taskId, name: taskId },
  variant: { id, name: `${taskId} variant`, params: { corpus: taskId } },
});

const SWR_VARIANT = makeVariant('variant-swr', 'swr');
const PA_VARIANT = makeVariant('variant-pa', 'pa');

/**
 * Builds an administration document equivalent to the one the query returns, with a fresh object
 * identity each call so a refetch can be simulated.
 */
const makeAdministration = (overrides = {}) => ({
  id: ADMINISTRATION_ID,
  name: 'Fall Screening',
  publicName: 'Fall Screening',
  dateOpened: '2026-01-01T00:00:00.000Z',
  dateClosed: '2026-06-01T00:00:00.000Z',
  sequential: true,
  testData: false,
  legal: { consent: 'consent-doc', assent: 'assent-doc' },
  minimalOrgs: { districts: ['district-1'], schools: [], classes: [], groups: [], families: [] },
  assessments: [
    { taskId: 'swr', variantId: 'variant-swr', params: { corpus: 'swr' } },
    { taskId: 'pa', variantId: 'variant-pa', params: { corpus: 'pa' } },
  ],
  ...overrides,
});

const TaskPickerStub = {
  name: 'TaskPicker',
  props: ['allVariants', 'allTaskBundles', 'inputVariants', 'preExistingAssessmentInfo'],
  template: '<div data-testid="task-picker-stub" />',
};

describe('CreateAdministration.vue', () => {
  let CreateAdministration;

  beforeEach(async () => {
    setActivePinia(createPinia());
    administrationData.value = undefined;
    allVariants.value = [];
    CreateAdministration = (await import('./CreateAdministration.vue')).default;
  });

  const mountForm = () =>
    mount(CreateAdministration, {
      props: { adminId: ADMINISTRATION_ID, formType: ADMINISTRATION_FORM_TYPES.EDIT },
      global: {
        plugins: [ToastService, ConfirmationService],
        stubs: {
          TaskPicker: TaskPickerStub,
          OrgPicker: true,
          ConsentPicker: true,
          AdministrationDatePicker: true,
          // Registered globally in setup.js, which unit tests don't run.
          AppSpinner: true,
        },
      },
    });

  const selectedVariantIds = (wrapper) =>
    wrapper
      .findComponent(TaskPickerStub)
      .props('inputVariants')
      .map((variant) => variant.id);

  it('hydrates the task selection from the saved administration', async () => {
    const wrapper = mountForm();
    administrationData.value = makeAdministration();
    allVariants.value = [SWR_VARIANT, PA_VARIANT];
    await wrapper.vm.$nextTick();

    expect(selectedVariantIds(wrapper)).toEqual(['variant-swr', 'variant-pa']);
  });

  it('does not re-add the saved assessments when the administration query refetches', async () => {
    // Regression for #2276. Both backing queries are served stale-while-revalidate, so a refetch
    // emits a new data reference for unchanged data and used to re-run the whole hydration.
    const wrapper = mountForm();
    administrationData.value = makeAdministration();
    allVariants.value = [SWR_VARIANT, PA_VARIANT];
    await wrapper.vm.$nextTick();

    administrationData.value = makeAdministration();
    await wrapper.vm.$nextTick();

    expect(selectedVariantIds(wrapper)).toEqual(['variant-swr', 'variant-pa']);
  });

  it('does not re-add the saved assessments when the variants query refetches', async () => {
    const wrapper = mountForm();
    administrationData.value = makeAdministration();
    allVariants.value = [SWR_VARIANT, PA_VARIANT];
    await wrapper.vm.$nextTick();

    allVariants.value = [makeVariant('variant-swr', 'swr'), makeVariant('variant-pa', 'pa')];
    await wrapper.vm.$nextTick();

    expect(selectedVariantIds(wrapper)).toEqual(['variant-swr', 'variant-pa']);
  });

  it('stays stable across repeated refetches', async () => {
    const wrapper = mountForm();
    administrationData.value = makeAdministration();
    allVariants.value = [SWR_VARIANT, PA_VARIANT];
    await wrapper.vm.$nextTick();

    for (let refetch = 0; refetch < 3; refetch += 1) {
      administrationData.value = makeAdministration();
      await wrapper.vm.$nextTick();
    }

    expect(selectedVariantIds(wrapper)).toHaveLength(2);
  });

  it('does not overwrite edits the user has already made when a refetch lands', async () => {
    const wrapper = mountForm();
    administrationData.value = makeAdministration();
    allVariants.value = [SWR_VARIANT, PA_VARIANT];
    await wrapper.vm.$nextTick();

    const nameInput = wrapper.get('[data-cy="input-administration-name"]');
    await nameInput.setValue('Renamed by the user');

    administrationData.value = makeAdministration();
    await wrapper.vm.$nextTick();

    expect(nameInput.element.value).toBe('Renamed by the user');
  });
});
