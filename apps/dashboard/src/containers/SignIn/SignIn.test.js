import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SignIn from './SignIn.vue';

describe('SignIn.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should display IdentifierInput when not showing password field and email link not sent', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const identifierInput = wrapper.findComponent({ name: 'IdentifierInput' });
    expect(identifierInput.exists()).toBe(true);
  });

  it('should display SignInEmailChip when email link sent or password field shown', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: 'test@example.com',
        password: '',
        invalid: false,
        showPasswordField: true,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const emailChip = wrapper.findComponent({ name: 'SignInEmailChip' });
    expect(emailChip.exists()).toBe(true);
  });

  it('should display SignInError when invalid prop is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: true,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const error = wrapper.findComponent({ name: 'SignInError' });
    expect(error.exists()).toBe(true);
    expect(error.props('show')).toBe(true);
  });

  it('should display SuccessAlert when showSuccessAlert is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: true,
        successEmail: 'test@example.com',
      },
    });

    const alert = wrapper.findComponent({ name: 'SuccessAlert' });
    expect(alert.exists()).toBe(true);
    expect(alert.props('show')).toBe(true);
  });

  it('should display PasswordInput when showPasswordField is true and not multiple providers', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: 'test@example.com',
        password: '',
        invalid: false,
        showPasswordField: true,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const passwordInput = wrapper.findComponent({ name: 'PasswordInput' });
    expect(passwordInput.exists()).toBe(true);
  });

  it('should display continue button when not multiple providers and email link not sent', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const button = wrapper.find('[data-cy="signin-continue"]');
    expect(button.exists()).toBe(true);
  });

  it('should hide continue button when multiple providers', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: true,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const button = wrapper.find('[data-cy="signin-continue"]');
    expect(button.exists()).toBe(false);
  });

  it('should emit update:email when IdentifierInput updates', async () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const identifierInput = wrapper.findComponent({ name: 'IdentifierInput' });
    await identifierInput.vm.$emit('update:model-value', 'test@example.com');

    expect(wrapper.emitted('update:email')).toBeTruthy();
    expect(wrapper.emitted('update:email')[0]).toEqual(['test@example.com']);
  });

  it('should emit check-providers when continue button clicked without password field', async () => {
    const wrapper = mount(SignIn, {
      props: {
        email: 'test@example.com',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const button = wrapper.find('[data-cy="signin-continue"]');
    await button.trigger('click');

    expect(wrapper.emitted('check-providers')).toBeTruthy();
    expect(wrapper.emitted('check-providers')[0]).toEqual(['test@example.com']);
  });

  it('should emit submit when continue button clicked with password field', async () => {
    const wrapper = mount(SignIn, {
      props: {
        email: 'test@example.com',
        password: 'password123',
        invalid: false,
        showPasswordField: true,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const button = wrapper.find('[data-cy="signin-continue"]');
    await button.trigger('click');

    expect(wrapper.emitted('submit')).toBeTruthy();
  });

  it('should display divider when conditions are met', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: true,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const divider = wrapper.find('.divider');
    expect(divider.exists()).toBe(true);
  });

  it('should display GenericProviders when conditions are met', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: ['google'],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const providers = wrapper.findComponent({ name: 'GenericProviders' });
    expect(providers.exists()).toBe(true);
  });

  it('should display ScopedProviders when conditions are met', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: ['clever'],
        showGenericProviders: false,
        showScopedProviders: true,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const providers = wrapper.findComponent({ name: 'ScopedProviders' });
    expect(providers.exists()).toBe(true);
  });

  it('should display MagicLinkBackButton when email link sent', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: 'test@example.com',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: true,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const backButton = wrapper.findComponent({ name: 'MagicLinkBackButton' });
    expect(backButton.exists()).toBe(true);
  });

  it('should emit all required events', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: [],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const expectedEmits = [
      'update:email',
      'update:password',
      'check-providers',
      'submit',
      'forgot-password',
      'magic-link',
      'back-to-password',
      'auth-clever',
      'auth-classlink',
      'auth-nycps',
      'auth-google',
      'clear-email',
    ];

    expectedEmits.forEach((emit) => {
      expect(wrapper.vm.$options.emits).toContain(emit);
    });
  });

  it('should display available providers label when multiple providers', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: true,
        emailLinkSent: false,
        hideProviders: false,
        isUsername: false,
        availableProviders: ['google', 'clever'],
        showGenericProviders: true,
        showScopedProviders: false,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const label = wrapper.find('.text-500');
    expect(label.exists()).toBe(true);
  });

  it('should hide providers when hideProviders is true', () => {
    const wrapper = mount(SignIn, {
      props: {
        email: '',
        password: '',
        invalid: false,
        showPasswordField: false,
        multipleProviders: false,
        emailLinkSent: false,
        hideProviders: true,
        isUsername: false,
        availableProviders: ['google'],
        showGenericProviders: true,
        showScopedProviders: true,
        showSuccessAlert: false,
        successEmail: '',
      },
    });

    const genericProviders = wrapper.findComponent({ name: 'GenericProviders' });
    const scopedProviders = wrapper.findComponent({ name: 'ScopedProviders' });

    expect(genericProviders.exists()).toBe(false);
    expect(scopedProviders.exists()).toBe(false);
  });
});
