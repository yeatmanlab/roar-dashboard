import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CheckboxInput from './CheckboxInput.vue';

function mountInput(props = {}, slots = {}) {
  return mount(CheckboxInput, {
    props: { label: 'Contact me', modelValue: false, ...props },
    slots,
  });
}

describe('CheckboxInput', () => {
  it('connects its label to a generated checkbox id', () => {
    const wrapper = mountInput();
    const input = wrapper.get('input');

    expect(input.attributes('id')).toMatch(/^checkbox-/);
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'));
    expect(wrapper.get('label').text()).toBe('Contact me');
  });

  it('renders rich label content and updates the model', async () => {
    const wrapper = mountInput({ id: 'legal-acceptance', required: true }, { default: 'I agree to the Terms' });

    await wrapper.get('input').setValue(true);

    expect(wrapper.get('label').text()).toContain('I agree to the Terms');
    expect(wrapper.get('input').attributes('required')).toBeDefined();
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
  });

  it('associates an error with an invalid checkbox', () => {
    const wrapper = mountInput({ id: 'legal-acceptance', error: 'Review and accept the Terms.' });

    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('legal-acceptance-error');
    expect(wrapper.get('#legal-acceptance-error').text()).toBe('Review and accept the Terms.');
  });
});
