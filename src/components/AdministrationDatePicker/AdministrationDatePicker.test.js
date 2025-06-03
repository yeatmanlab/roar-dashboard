import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AdministrationDatePicker from './AdministrationDatePicker.vue';
import { datePresets } from './presets';
import _capitalize from 'lodash/capitalize';

// Mock PrimeVue components
vi.mock('primevue/selectbutton', () => ({
  default: {
    name: 'PvSelectButton',
    template: '<div><slot /></div>',
  },
}));

vi.mock('primevue/panel', () => ({
  default: {
    name: 'PvPanel',
    template: '<div><slot /></div>',
  },
}));

// Mock DatePicker component
vi.mock('../../RoarDatePicker/DatePicker.vue', () => ({
  default: {
    name: 'DatePicker',
    template: '<input type="date" />',
  },
}));

describe('AdministrationDatePicker.vue', () => {
  let wrapper;
  const currentYear = new Date().getFullYear();
  const minStartDate = new Date(currentYear, 0, 1); // January 1st
  const minEndDate = new Date(currentYear, 0, 2); // January 2nd

  beforeEach(() => {
    wrapper = mount(AdministrationDatePicker, {
      props: {
        minStartDate,
        minEndDate,
        startDate: null,
        endDate: null,
        'onUpdate:startDate': (e) => wrapper.setProps({ startDate: e }),
        'onUpdate:endDate': (e) => wrapper.setProps({ endDate: e }),
      },
    });
  });

  it('initializes with correct default values', () => {
    expect(wrapper.vm.decision).toBe('presets');
    expect(wrapper.vm.selectedPreset).toBeNull();
  });

  it('selects a preset correctly', async () => {
    const preset = 'summer';
    await wrapper.vm.presetChange(preset);

    expect(wrapper.vm.selectedPreset).toBe(preset);
    expect(wrapper.vm.startDate).toEqual(datePresets[preset].start);
    expect(wrapper.vm.endDate).toEqual(datePresets[preset].end);
  });

  it('formats dates correctly', () => {
    const testDate = new Date(2025, 0, 1); // January 1st, 2025
    const formattedDate = wrapper.vm.getDateString(testDate);
    expect(formattedDate).toBe('January 1, 2025');
  });

  it('switches to custom mode when non-preset dates are provided', async () => {
    const customStartDate = new Date(2025, 5, 1); // June 1st, 2025
    const customEndDate = new Date(2025, 5, 30); // June 30th, 2025

    // Mount a new instance with the custom dates
    const customWrapper = mount(AdministrationDatePicker, {
      props: {
        minStartDate,
        minEndDate,
        startDate: customStartDate,
        endDate: customEndDate,
        'onUpdate:startDate': (e) => customWrapper.setProps({ startDate: e }),
        'onUpdate:endDate': (e) => customWrapper.setProps({ endDate: e }),
      },
    });

    await customWrapper.vm.$nextTick();
    expect(customWrapper.vm.decision).toBe('custom');
  });

  it('stays in preset mode when preset dates are provided', async () => {
    const preset = datePresets.summer;

    // Mount a new instance with the preset dates
    const presetWrapper = mount(AdministrationDatePicker, {
      props: {
        minStartDate,
        minEndDate,
        startDate: preset.start,
        endDate: preset.end,
        'onUpdate:startDate': (e) => presetWrapper.setProps({ startDate: e }),
        'onUpdate:endDate': (e) => presetWrapper.setProps({ endDate: e }),
      },
    });

    await presetWrapper.vm.$nextTick();
    expect(presetWrapper.vm.decision).toBe('presets');
  });

  it('highlights selected preset card', async () => {
    const preset = 'summer';
    await wrapper.vm.presetChange(preset);

    const selectedCard = wrapper.find('.selected-card');
    expect(selectedCard.exists()).toBe(true);
    expect(selectedCard.text()).toContain(_capitalize(preset));
  });
});
