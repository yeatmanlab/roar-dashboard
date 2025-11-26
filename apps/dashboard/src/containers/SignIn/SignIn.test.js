import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SignIn from './SignIn.vue';

describe('SignIn.vue', () => {
  const defaultProps = {
    email: '',
    password: '',
    invalid: false,
    showPasswordField: false,
    multipleProviders: false,
    emailLinkSent: false,
    hideProviders: false,
    isUsername: false,
    availableProviders: [],
    showSuccessAlert: false,
    successEmail: '',
  };

  it('should render the component', () => {
    const wrapper = mount(SignIn, {
      props: defaultProps,
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should display IdentifierInput when not showing password field and email link not sent', () => {
    const wrapper = mount(SignIn, {
      props: defaultProps,
    });

    const identifierInput = wrapper.findComponent({ name: 'IdentifierInput' });
    expect(identifierInput.exists()).toBe(true);
  });

  it('should display SignInEmailChip when email link sent or password field shown', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        email: 'test@example.com',
        showPasswordField: true,
      },
    });

    const emailChip = wrapper.findComponent({ name: 'SignInEmailChip' });
    expect(emailChip.exists()).toBe(true);
  });

  it('should display SignInError when invalid prop is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        invalid: true,
      },
    });

    const error = wrapper.findComponent({ name: 'SignInError' });
    expect(error.exists()).toBe(true);
    expect(error.props('show')).toBe(true);
  });

  it('should display SuccessAlert when showSuccessAlert is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        showSuccessAlert: true,
        successEmail: 'test@example.com',
      },
    });

    const successAlert = wrapper.findComponent({ name: 'SuccessAlert' });
    expect(successAlert.exists()).toBe(true);
  });

  it('should display PasswordInput when showPasswordField is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        showPasswordField: true,
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'PasswordInput' });
    expect(passwordInput.exists()).toBe(true);
  });

  it('should display GenericProviders when not hideProviders and not multipleProviders', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        hideProviders: false,
        multipleProviders: false,
      },
    });

    const genericProviders = wrapper.findComponent({ name: 'GenericProviders' });
    expect(genericProviders.exists()).toBe(true);
  });

  it('should display ScopedProviders when multipleProviders is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        multipleProviders: true,
        availableProviders: ['google', 'clever'],
      },
    });

    const scopedProviders = wrapper.findComponent({ name: 'ScopedProviders' });
    expect(scopedProviders.exists()).toBe(true);
  });

  it('should not display providers when hideProviders is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        hideProviders: true,
      },
    });

    const genericProviders = wrapper.findComponent({ name: 'GenericProviders' });
    const scopedProviders = wrapper.findComponent({ name: 'ScopedProviders' });
    expect(genericProviders.exists()).toBe(false);
    expect(scopedProviders.exists()).toBe(false);
  });

  it('should display divider only when not on password field, email link not sent, not hiding providers, and not multiple providers', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        showPasswordField: false,
        emailLinkSent: false,
        hideProviders: false,
        multipleProviders: false,
      },
    });

    const divider = wrapper.find('.divider');
    expect(divider.exists()).toBe(true);
  });

  it('should not display divider when multipleProviders is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        multipleProviders: true,
      },
    });

    const divider = wrapper.find('.divider');
    expect(divider.exists()).toBe(false);
  });

  it('should pass availableProviders to ScopedProviders', () => {
    const wrapper = mount(SignIn, {
      props: {
        ...defaultProps,
        multipleProviders: true,
        availableProviders: ['google', 'clever', 'classlink'],
      },
    });

    const scopedProviders = wrapper.findComponent({ name: 'ScopedProviders' });
    expect(scopedProviders.props('availableProviders')).toEqual(['google', 'clever', 'classlink']);
  });

  it('should update when props change', async () => {
    const wrapper = mount(SignIn, {
      props: defaultProps,
    });

    let identifierInput = wrapper.findComponent({ name: 'IdentifierInput' });
    expect(identifierInput.exists()).toBe(true);

    await wrapper.setProps({ showPasswordField: true });

    const passwordInput = wrapper.findComponent({ name: 'PasswordInput' });
    expect(passwordInput.exists()).toBe(true);
  });
});
