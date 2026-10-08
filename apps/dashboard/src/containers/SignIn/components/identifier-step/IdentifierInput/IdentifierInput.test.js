import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import IdentifierInput from './IdentifierInput.vue';

function mountInput(props = {}) {
  return mount(IdentifierInput, {
    props: { modelValue: '', invalid: false, ...props },
    global: {
      mocks: {
        $t: (key) =>
          ({
            'authSignIn.emailPlaceholder': 'Enter your email or username',
            'authSignIn.incorrectEmailOrPassword': 'Invalid username/email or password.',
          })[key],
      },
    },
  });
}

describe('IdentifierInput.vue', () => {
  it('renders the shared redesigned text input with sign-in semantics', () => {
    const wrapper = mountInput({ modelValue: 'test@example.com' });
    const control = wrapper.getComponent({ name: 'FormTextInput' });
    const input = wrapper.get('input');

    expect(control.props('modelValue')).toBe('test@example.com');
    expect(control.props('labelHidden')).toBe(true);
    expect(input.attributes('id')).toBe('email');
    expect(input.attributes('name')).toBe('email');
    expect(input.attributes('autocomplete')).toBe('username');
    expect(input.attributes('data-cy')).toBe('sign-in__username');
  });

  it('emits model updates from the shared control', async () => {
    const wrapper = mountInput();

    await wrapper.get('input').setValue('newemail@example.com');

    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['newemail@example.com']);
  });

  it('shows and clears the translated invalid-credential error', async () => {
    const wrapper = mountInput();

    expect(wrapper.find('.roar-form-control__error').exists()).toBe(false);

    await wrapper.setProps({ invalid: true });
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('.roar-form-control__error').text()).toBe('Invalid username/email or password.');

    await wrapper.setProps({ invalid: false });
    expect(wrapper.find('.roar-form-control__error').exists()).toBe(false);
  });

  it('emits enter with the current identifier', async () => {
    const wrapper = mountInput({ modelValue: 'owner@example.com' });

    await wrapper.get('input').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('enter')).toEqual([['owner@example.com']]);
  });
});
