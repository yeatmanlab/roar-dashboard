import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TextInput from './TextInput.vue';

function mountInput(props = {}, attrs = {}) {
  return mount(TextInput, {
    props: { label: 'Email address', modelValue: '', ...props },
    attrs,
  });
}

describe('TextInput', () => {
  it('connects its visible label to the input and marks required fields', () => {
    const wrapper = mountInput({ required: true });
    const input = wrapper.get('input');

    expect(input.attributes('id')).toMatch(/^input-/);
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'));
    expect(input.attributes('required')).toBeDefined();
    expect(wrapper.get('label').text()).toContain('Email address');
    expect(wrapper.get('label').text()).toContain('(required)');
  });

  it('forwards native attributes and updates the model', async () => {
    const wrapper = mountInput(
      { id: 'owner-email' },
      { name: 'email', autocomplete: 'email', 'data-cy': 'owner-email' },
    );

    await wrapper.get('input').setValue('owner@example.com');

    expect(wrapper.get('input').attributes('name')).toBe('email');
    expect(wrapper.get('input').attributes('autocomplete')).toBe('email');
    expect(wrapper.get('input').attributes('data-cy')).toBe('owner-email');
    expect(wrapper.emitted('update:modelValue')).toEqual([['owner@example.com']]);
  });

  it('associates help and actionable error text with the input', () => {
    const wrapper = mountInput({ id: 'owner-email', help: 'Use your primary email.', error: 'Enter a valid email.' });
    const input = wrapper.get('input');

    expect(input.attributes('aria-invalid')).toBe('true');
    expect(input.attributes('aria-describedby')).toBe('owner-email-help owner-email-error');
    expect(wrapper.get('#owner-email-help').text()).toBe('Use your primary email.');
    expect(wrapper.get('#owner-email-error').text()).toBe('Enter a valid email.');
  });
});
