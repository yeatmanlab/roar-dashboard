import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CheckboxInput from './CheckboxInput.vue';

describe('CheckboxInput', () => {
  it('emits model update event with correct value when checkbox is clicked', async () => {
    const wrapper = mount(CheckboxInput, {
      props: {
        modelValue: false,
        'onUpdate:modelValue': (e) => wrapper.setProps({ modelValue: e }),
      },
    });

    await wrapper.find('input').trigger('click');
    expect(wrapper.props('modelValue')).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([true]);

    await wrapper.find('input').trigger('click');
    expect(wrapper.props('modelValue')).toBe(false);
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[1]).toEqual([false]);
  });

  it('generates a unique id for the checkbox if none is provided', () => {
    const wrapper = mount(CheckboxInput, {
      modelValue: false,
    });
    const inputId = wrapper.find('input').attributes('id');
    const labelId = wrapper.find('label').attributes('for');
    expect(inputId).toMatch(/^checkbox-/);
    expect(labelId).toBe(inputId);
  });

  it('uses the provided id for the checkbox', () => {
    const mockId = 'mock-id';
    const wrapper = mount(CheckboxInput, {
      props: {
        modelValue: true,
        id: mockId,
      },
    });
    const inputId = wrapper.find('input').attributes('id');
    const labelId = wrapper.find('label').attributes('for');
    expect(inputId).toBe(mockId);
    expect(labelId).toBe(inputId);
  });
});
