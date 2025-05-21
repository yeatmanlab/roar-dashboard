import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TaskPicker from '../TaskPicker.vue';
import VariantCard from '../VariantCard.vue';
import { VueDraggableNext } from 'vue-draggable-next';

// Mock PrimeVue components
vi.mock('primevue/button', () => ({
  default: {
    name: 'PvButton',
    template: '<button><slot /></button>',
  },
}));

vi.mock('primevue/select', () => ({
  default: {
    name: 'PvSelect',
    template: '<select><slot /></select>',
  },
}));

vi.mock('primevue/inputswitch', () => ({
  default: {
    name: 'PvInputSwitch',
    template: '<input type="checkbox" />',
  },
}));

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn(),
  }),
}));

// Mock sample data
const mockAllVariants = {
  task1: [
    {
      id: 'variant1',
      name: 'Variant 1',
      task: { id: 'task1', name: 'Task 1' },
    },
    {
      id: 'variant2',
      name: 'Variant 2',
      task: { id: 'task1', name: 'Task 1' },
    },
  ],
  task2: [
    {
      id: 'variant3',
      name: 'Variant 3',
      task: { id: 'task2', name: 'Task 2' },
    },
  ],
};

describe('TaskPicker.vue', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(TaskPicker, {
      props: {
        allVariants: mockAllVariants,
        inputVariants: [],
        preExistingAssessmentInfo: [],
      },
      global: {
        stubs: {
          PvPanel: true,
          PvScrollPanel: true,
          PvIconField: true,
          PvInputIcon: true,
          PvInputText: true,
          VueDraggableNext: true,
          VariantCard: true,
        },
      },
    });
  });

  it('initializes with correct default values', () => {
    expect(wrapper.vm.namedOnly).toBe(true);
    expect(wrapper.vm.currentTask).toBe('task1');
    expect(wrapper.vm.selectedVariants).toEqual([]);
  });

  it('computes task options correctly', () => {
    const expectedOptions = [
      { label: 'Task 1', value: 'task1' },
      { label: 'Task 2', value: 'task2' },
    ];
    expect(wrapper.vm.taskOptions).toEqual(expectedOptions);
  });

  it('filters variants based on namedOnly switch', async () => {
    // Add an unnamed variant
    const unnamedVariant = {
      id: 'variant4',
      name: '',
      task: { id: 'task1', name: 'Task 1' },
    };
    const newAllVariants = {
      ...mockAllVariants,
      task1: [...mockAllVariants.task1, unnamedVariant],
    };

    await wrapper.setProps({ allVariants: newAllVariants });

    // With namedOnly = true
    expect(wrapper.vm.currentVariants.length).toBe(2);

    // Toggle namedOnly to false
    await wrapper.setData({ namedOnly: false });
    expect(wrapper.vm.currentVariants.length).toBe(3);
  });

  it('emits variants-changed event when selectedVariants changes', async () => {
    const variant = mockAllVariants.task1[0];
    await wrapper.setData({ selectedVariants: [variant] });

    expect(wrapper.emitted('variants-changed')).toBeTruthy();
    expect(wrapper.emitted('variants-changed')[0][0]).toEqual([variant]);
  });

  it('handles card removal correctly', async () => {
    const variant = mockAllVariants.task1[0];
    await wrapper.setData({ selectedVariants: [variant] });

    wrapper.vm.removeCard(variant);
    expect(wrapper.vm.selectedVariants).toEqual([]);
  });

  it('handles search functionality', async () => {
    await wrapper.setData({ searchTerm: 'Variant 1' });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(wrapper.vm.searchResults).toEqual([expect.objectContaining({ id: 'variant1', name: 'Variant 1' })]);
  });

  it('handles card movement correctly', async () => {
    const variants = mockAllVariants.task1;
    await wrapper.setData({ selectedVariants: [...variants] });

    wrapper.vm.moveCardUp(variants[1]);
    expect(wrapper.vm.selectedVariants[0].id).toBe('variant2');

    wrapper.vm.moveCardDown(variants[0]);
    expect(wrapper.vm.selectedVariants[1].id).toBe('variant1');
  });
});
