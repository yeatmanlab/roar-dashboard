import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DatePicker from './DateInput.vue';

// Mock PrimeVue components
vi.mock('primevue/datepicker', () => ({
  default: {
    name: 'PvDatePicker',
    template: '<input type="text" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: [
      'modelValue',
      'minDate',
      'maxDate',
      'manualInput',
      'showIcon',
      'icon',
      'inputId',
      'showButtonBar',
      'dataCy',
    ],
  },
}));

vi.mock('primevue/floatlabel', () => ({
  default: {
    name: 'PvFloatLabel',
    template: '<div><slot /></div>',
  },
}));

describe('DatePicker.vue', () => {
  let wrapper;
  const label = 'Test Date';
  const dataCy = 'test-date-picker';

  beforeEach(() => {
    wrapper = mount(DatePicker, {
      props: {
        label,
        dataCy,
        modelValue: null,
        'onUpdate:modelValue': (e) => wrapper.setProps({ modelValue: e }),
      },
    });
  });

  it('renders the label correctly', () => {
    expect(wrapper.find('label').text()).toBe(label);
  });

  it('updates the model value when PvDatePicker emits an update', async () => {
    const pvDatePicker = wrapper.findComponent({ name: 'PvDatePicker' });
    const testDate = new Date(2024, 5, 15);
    await pvDatePicker.vm.$emit('update:modelValue', testDate);
    expect(wrapper.props('modelValue')).toEqual(testDate);
  });

  it('displays an error message when hasError is true', async () => {
    const errorMessage = 'This is an error';
    await wrapper.setProps({ hasError: true, errorMessage });
    const errorElement = wrapper.find('.p-error');
    expect(errorElement.exists()).toBe(true);
    expect(errorElement.text()).toBe(errorMessage);
  });

  it('does not display an error message when hasError is false', () => {
    const errorElement = wrapper.find('.p-error');
    expect(errorElement.exists()).toBe(false);
  });

  it('passes minDate and maxDate props to PvDatePicker', async () => {
    const minDate = new Date(2024, 0, 1);
    const maxDate = new Date(2024, 11, 31);
    await wrapper.setProps({ minDate, maxDate });
    const pvDatePicker = wrapper.findComponent({ name: 'PvDatePicker' });
    expect(pvDatePicker.props('minDate')).toEqual(minDate);
    expect(pvDatePicker.props('maxDate')).toEqual(maxDate);
  });

  it('passes manualInput prop to PvDatePicker', async () => {
    await wrapper.setProps({ manualInput: false });
    const pvDatePicker = wrapper.findComponent({ name: 'PvDatePicker' });
    expect(pvDatePicker.props('manualInput')).toBe(false);
  });
});
