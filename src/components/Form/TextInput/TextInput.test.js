import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TextInput from './TextInput.vue';

describe('TextInput', async () => {
  it('emits model update event with correct value when input value changes', async () => {
    const wrapper = mount(TextInput, {
      props: {
        label: 'Input label',
        modelValue: '',
        'onUpdate:modelValue': (e) => wrapper.setProps({ modelValue: e }),
      },
    });

    const input = wrapper.find('input');
    await input.setValue('test value');
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['test value']);
  });

  it('generates a unique id for the input if none is provided', () => {
    const wrapper = mount(TextInput, {
      props: {
        label: 'Input label',
        modelValue: '',
      },
    });
    const inputId = wrapper.find('input').attributes('id');
    const labelId = wrapper.find('label').attributes('for');
    expect(inputId).toMatch(/^input-/);
    expect(labelId).toBe(inputId);
  });

  it('uses the provided id for the input', () => {
    const mockId = 'mock-id';
    const wrapper = mount(TextInput, {
      props: {
        label: 'Input label',
        modelValue: '',
        id: mockId,
      },
    });
    const inputId = wrapper.find('input').attributes('id');
    const labelId = wrapper.find('label').attributes('for');
    expect(inputId).toBe(mockId);
    expect(labelId).toBe(inputId);
  });
});
