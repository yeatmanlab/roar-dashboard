import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import TaskPicker from './TaskPicker.vue';

// Reached transitively via @/helpers/reports. The published package imports './utils' without a
// file extension, which Vite cannot resolve as ESM.
vi.mock('@bdelab/roar-utils', () => ({
  getGrade: vi.fn((grade) => parseInt(grade, 10)),
}));

const SELECTED_TASKS_ZONE = '[data-cy="panel-droppable-zone"]';

const makeVariant = (id, taskId, params = {}) => ({
  id,
  task: { id: taskId, name: taskId },
  variant: { id, name: `${taskId} variant`, params },
});

const mountTaskPicker = (props = {}) =>
  mount(TaskPicker, {
    props: {
      allVariants: { swr: [makeVariant('variant-swr', 'swr')], pa: [makeVariant('variant-pa', 'pa')] },
      allTaskBundles: [],
      inputVariants: [],
      preExistingAssessmentInfo: [],
      ...props,
    },
    global: {
      // PrimeVue itself is registered globally in vitest.setup.js.
      plugins: [ToastService, ConfirmationService],
      stubs: {
        VueDraggableNext: { template: '<div><slot /></div>' },
        VariantCard: true,
        TaskGroupCard: true,
        PvScrollPanel: { template: '<div><slot /></div>' },
      },
    },
  });

/**
 * Reads the variant cards rendered in the "Selected Tasks" column.
 */
const selectedCards = (wrapper) => wrapper.get(SELECTED_TASKS_ZONE).findAllComponents({ name: 'VariantCard' });

const selectedVariantIds = (wrapper) => selectedCards(wrapper).map((card) => card.props('variant').id);

describe('TaskPicker.vue', () => {
  it('renders a card for each variant supplied by the parent', async () => {
    const wrapper = mountTaskPicker({
      inputVariants: [makeVariant('variant-swr', 'swr'), makeVariant('variant-pa', 'pa')],
    });
    await wrapper.vm.$nextTick();

    expect(selectedVariantIds(wrapper)).toEqual(['variant-swr', 'variant-pa']);
  });

  it('does not duplicate cards when the parent re-supplies the same variants', async () => {
    // Regression for #2276. A TanStack refetch makes CreateAdministration rebuild its
    // preSelectedVariants array, handing this component an equivalent but non-identical list.
    const wrapper = mountTaskPicker({
      inputVariants: [makeVariant('variant-swr', 'swr'), makeVariant('variant-pa', 'pa')],
    });
    await wrapper.vm.$nextTick();

    await wrapper.setProps({
      inputVariants: [makeVariant('variant-swr', 'swr'), makeVariant('variant-pa', 'pa')],
    });
    await wrapper.vm.$nextTick();

    expect(selectedVariantIds(wrapper)).toEqual(['variant-swr', 'variant-pa']);
  });

  it('keeps the selection stable across repeated re-supplies', async () => {
    const wrapper = mountTaskPicker({ inputVariants: [makeVariant('variant-swr', 'swr')] });
    await wrapper.vm.$nextTick();

    for (let refetch = 0; refetch < 3; refetch += 1) {
      await wrapper.setProps({ inputVariants: [makeVariant('variant-swr', 'swr')] });
      await wrapper.vm.$nextTick();
    }

    expect(selectedVariantIds(wrapper)).toEqual(['variant-swr']);
  });

  it('adds genuinely new variants without dropping the existing selection', async () => {
    const wrapper = mountTaskPicker({ inputVariants: [makeVariant('variant-swr', 'swr')] });
    await wrapper.vm.$nextTick();

    await wrapper.setProps({
      inputVariants: [makeVariant('variant-swr', 'swr'), makeVariant('variant-pa', 'pa')],
    });
    await wrapper.vm.$nextTick();

    expect(selectedVariantIds(wrapper)).toEqual(['variant-swr', 'variant-pa']);
  });

  it('applies pre-existing assessment conditions to the selected variants', async () => {
    const conditions = { assigned: { field: 'studentData.grade', op: 'LESS_THAN', value: 2 } };
    const wrapper = mountTaskPicker({
      inputVariants: [makeVariant('variant-swr', 'swr')],
      preExistingAssessmentInfo: [{ variantId: 'variant-swr', conditions }],
    });
    await wrapper.vm.$nextTick();

    expect(selectedCards(wrapper)[0].props('variant').variant.conditions).toEqual(conditions);
  });

  it('notifies the parent when the selection changes', async () => {
    const wrapper = mountTaskPicker({ inputVariants: [makeVariant('variant-swr', 'swr')] });
    await wrapper.vm.$nextTick();

    await wrapper.setProps({
      inputVariants: [makeVariant('variant-swr', 'swr'), makeVariant('variant-pa', 'pa')],
    });
    await wrapper.vm.$nextTick();

    const lastEmission = wrapper.emitted('variants-changed').at(-1)[0];
    expect(lastEmission.map((variant) => variant.id)).toEqual(['variant-swr', 'variant-pa']);
  });
});
