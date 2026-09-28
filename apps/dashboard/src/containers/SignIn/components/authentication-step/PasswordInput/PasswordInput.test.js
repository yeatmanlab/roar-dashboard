import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PasswordInput from './PasswordInput.vue';

function mountInput(props = {}) {
  return mount(PasswordInput, {
    props: { show: true, isUsername: false, invalid: false, password: '', ...props },
    global: {
      mocks: {
        $t: (key) =>
          ({
            'authSignIn.passwordPlaceholder': 'Password',
            'authSignIn.forgotPassword': 'Forgot password?',
            'authSignIn.magicLink': 'Request email link',
          })[key],
      },
    },
  });
}

describe('PasswordInput.vue', () => {
  it('does not display when show is false', () => {
    const wrapper = mountInput({ show: false });

    expect(wrapper.find('.field').exists()).toBe(false);
  });

  it('renders the shared redesigned password input with sign-in semantics', () => {
    const wrapper = mountInput({ password: 'safe-password' });
    const control = wrapper.getComponent({ name: 'FormPasswordInput' });
    const input = wrapper.get('input');

    expect(control.props('modelValue')).toBe('safe-password');
    expect(control.props('labelHidden')).toBe(true);
    expect(input.attributes('id')).toBe('password');
    expect(input.attributes('name')).toBe('password');
    expect(input.attributes('autocomplete')).toBe('current-password');
    expect(input.attributes('data-cy')).toBe('sign-in__password');
  });

  it('emits password updates from the shared control', async () => {
    const wrapper = mountInput();

    await wrapper.get('input').setValue('newpassword');
    expect(wrapper.emitted('update:password')[0]).toEqual(['newpassword']);
  });

  it('displays recovery actions for email identifiers', () => {
    const wrapper = mountInput();

    const links = wrapper.findAll('small');
    expect(links).toHaveLength(2);
  });

  it('hides recovery actions for username identifiers', () => {
    const wrapper = mountInput({ isUsername: true });

    expect(wrapper.find('.flex.w-full').exists()).toBe(false);
  });

  it('emits the selected recovery action', async () => {
    const wrapper = mountInput();

    const links = wrapper.findAll('small');
    await links[0].trigger('click');
    await links[1].trigger('click');

    expect(wrapper.emitted('forgot-password')).toHaveLength(1);
    expect(wrapper.emitted('magic-link')).toHaveLength(1);
  });

  it('passes invalid state through and emits submit on Enter', async () => {
    const wrapper = mountInput({ invalid: true });

    expect(wrapper.getComponent({ name: 'FormPasswordInput' }).props('invalid')).toBe(true);
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');

    await wrapper.get('input').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });
});
