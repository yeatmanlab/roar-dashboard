import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PasswordInput from './PasswordInput.vue';

function mountInput(props = {}, attrs = {}) {
  return mount(PasswordInput, {
    props: { id: 'owner-password', label: 'Password', modelValue: '', ...props },
    attrs,
  });
}

describe('PasswordInput', () => {
  it('toggles visibility without changing the password value', async () => {
    const wrapper = mountInput({ modelValue: 'safe-password' });
    const input = wrapper.get('input');

    expect(input.attributes('type')).toBe('password');
    await wrapper.get('[aria-label="Show password"]').trigger('click');

    expect(input.attributes('type')).toBe('text');
    expect(input.element.value).toBe('safe-password');
    expect(wrapper.get('[aria-label="Hide password"]').attributes('aria-pressed')).toBe('true');
  });

  it('forwards native attributes and updates the model', async () => {
    const wrapper = mountInput({}, { name: 'password', autocomplete: 'new-password', 'data-cy': 'owner-password' });

    await wrapper.get('input').setValue('new-password');

    expect(wrapper.get('input').attributes('name')).toBe('password');
    expect(wrapper.get('input').attributes('autocomplete')).toBe('new-password');
    expect(wrapper.get('input').attributes('data-cy')).toBe('owner-password');
    expect(wrapper.emitted('update:modelValue')).toEqual([['new-password']]);
  });

  it('associates password guidance and errors with the input', () => {
    const wrapper = mountInput({ help: 'Use at least 8 characters.', error: 'Create a password.' });

    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('owner-password-help owner-password-error');
    expect(wrapper.get('#owner-password-help').text()).toBe('Use at least 8 characters.');
    expect(wrapper.get('#owner-password-error').text()).toBe('Create a password.');
  });
});
