import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PasswordInput from './PasswordInput.vue';

describe('PasswordInput.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: false,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should not display when show is false', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: false,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const field = wrapper.find('.field');
    expect(field.exists()).toBe(false);
  });

  it('should display when show is true', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const field = wrapper.find('.field');
    expect(field.exists()).toBe(true);
  });

  it('should display password input field', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.exists()).toBe(true);
  });

  it('should have data-cy attribute', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.attributes('data-cy')).toBe('sign-in__password');
  });

  it('should emit update:password when password changes', async () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'Password' });
    await passwordInput.vm.$emit('update:model-value', 'newpassword');

    expect(wrapper.emitted('update:password')).toBeTruthy();
    expect(wrapper.emitted('update:password')[0]).toEqual(['newpassword']);
  });

  it('should display forgot password link when not username', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const links = wrapper.findAll('small');
    expect(links.length).toBeGreaterThan(0);
  });

  it('should hide forgot password link when isUsername is true', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: true,
        invalid: false,
        password: '',
      },
    });

    const linksContainer = wrapper.find('.flex.w-full');
    expect(linksContainer.exists()).toBe(false);
  });

  it('should emit forgot-password when forgot password link clicked', async () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const links = wrapper.findAll('small');
    const forgotPasswordLink = links[0];
    await forgotPasswordLink.trigger('click');

    expect(wrapper.emitted('forgot-password')).toBeTruthy();
  });

  it('should emit magic-link when magic link clicked', async () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const links = wrapper.findAll('small');
    const magicLinkButton = links[1];
    await magicLinkButton.trigger('click');

    expect(wrapper.emitted('magic-link')).toBeTruthy();
  });

  it('should apply invalid class when invalid is true', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: true,
        password: '',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.classes()).toContain('p-invalid');
  });

  it('should not apply invalid class when invalid is false', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.classes()).not.toContain('p-invalid');
  });

  it('should have toggle mask enabled', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.props('toggleMask')).toBe(true);
  });

  it('should have feedback disabled', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: '',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.props('feedback')).toBe(false);
  });

  it('should display password value', () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: 'mypassword',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.props('modelValue')).toBe('mypassword');
  });

  it('should update when props change', async () => {
    const wrapper = mount(PasswordInput, {
      props: {
        show: true,
        isUsername: false,
        invalid: false,
        password: 'oldpassword',
      },
    });

    let passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.props('modelValue')).toBe('oldpassword');

    await wrapper.setProps({ password: 'newpassword' });

    passwordInput = wrapper.findComponent({ name: 'Password' });
    expect(passwordInput.props('modelValue')).toBe('newpassword');
  });
});
