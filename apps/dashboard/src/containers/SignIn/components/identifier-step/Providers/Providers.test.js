import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Providers from './Providers.vue';
import ProviderButton from '@/containers/SignIn/components/shared/ProviderButton/ProviderButton.vue';

vi.mock('@/assets/provider-google-logo.svg', () => ({ default: '/mocked/google-logo.svg' }));
vi.mock('@/assets/provider-clever-logo.svg', () => ({ default: '/mocked/clever-logo.svg' }));
vi.mock('@/assets/provider-classlink-logo.png', () => ({ default: '/mocked/classlink-logo.png' }));
vi.mock('@/assets/provider-nycps-logo.jpg', () => ({ default: '/mocked/nycps-logo.jpg' }));

describe('Providers.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: [],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should render container div with correct classes', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: [],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const container = wrapper.find('div');
    expect(container.classes()).toContain('flex');
    expect(container.classes()).toContain('flex-column');
    expect(container.classes()).toContain('w-full');
  });

  it('should render Google provider button when google is in availableProviders', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['google'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(1);
    expect(buttons[0].attributes('data-cy')).toBe('sign-in__google-sso');
  });

  it('should render Clever provider button when showAllDistrict is true', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: [],
        showAllDistrict: true,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    const cleverButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__clever-sso');
    expect(cleverButton).toBeDefined();
  });

  it('should render ClassLink provider button when showAllDistrict is true', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: [],
        showAllDistrict: true,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    const classlinkButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__classlink-sso');
    expect(classlinkButton).toBeDefined();
  });

  it('should render NYCPS provider button when showAllDistrict is true', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: [],
        showAllDistrict: true,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    const nycpsButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__nycps-sso');
    expect(nycpsButton).toBeDefined();
  });

  it('should render all three district providers when showAllDistrict is true', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: [],
        showAllDistrict: true,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(3);
  });

  it('should render multiple providers when multiple are available', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['google', 'clever', 'classlink'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(3);
  });

  it('should not render provider buttons when availableProviders is empty and showAllDistrict is false', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: [],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(0);
  });

  it('should emit auth-google event when Google button is clicked', async () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['google'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const googleButton = wrapper.findAllComponents(ProviderButton)[0];
    await googleButton.trigger('click');

    expect(wrapper.emitted('auth-google')).toBeTruthy();
  });

  it('should emit auth-clever event when Clever button is clicked', async () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['clever'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const cleverButton = wrapper.findAllComponents(ProviderButton)[0];
    await cleverButton.trigger('click');

    expect(wrapper.emitted('auth-clever')).toBeTruthy();
  });

  it('should emit auth-classlink event when ClassLink button is clicked', async () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['classlink'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const classlinkButton = wrapper.findAllComponents(ProviderButton)[0];
    await classlinkButton.trigger('click');

    expect(wrapper.emitted('auth-classlink')).toBeTruthy();
  });

  it('should emit auth-nycps event when NYCPS button is clicked', async () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['nycps'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const nycpsButton = wrapper.findAllComponents(ProviderButton)[0];
    await nycpsButton.trigger('click');

    expect(wrapper.emitted('auth-nycps')).toBeTruthy();
  });

  it('should have correct data-cy attributes for each provider', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    const dataCyValues = buttons.map((btn) => btn.attributes('data-cy'));

    expect(dataCyValues).toContain('sign-in__google-sso');
    expect(dataCyValues).toContain('sign-in__clever-sso');
    expect(dataCyValues).toContain('sign-in__classlink-sso');
    expect(dataCyValues).toContain('sign-in__nycps-sso');
  });

  it('should pass correct image sources to provider buttons', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons[0].props('imgSrc')).toBe('/mocked/google-logo.svg');
    expect(buttons[1].props('imgSrc')).toBe('/mocked/clever-logo.svg');
    expect(buttons[2].props('imgSrc')).toBe('/mocked/classlink-logo.png');
    expect(buttons[3].props('imgSrc')).toBe('/mocked/nycps-logo.jpg');
  });

  it('should render Clever button when available even if showAllDistrict is false', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['clever'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(1);
    expect(buttons[0].attributes('data-cy')).toBe('sign-in__clever-sso');
  });

  it('should have correct button styling classes', () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['google'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    const button = wrapper.findComponent(ProviderButton);
    const buttonClasses = button.classes();

    expect(buttonClasses).toContain('flex');
    expect(buttonClasses).toContain('h-1');
    expect(buttonClasses).toContain('m-1');
    expect(buttonClasses).toContain('w-full');
    expect(buttonClasses).toContain('border-round-md');
  });

  it('should update when availableProviders prop changes', async () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: ['google'],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    let buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(1);

    await wrapper.setProps({ availableProviders: ['google', 'clever'] });

    buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(2);
  });

  it('should update when showAllDistrict prop changes', async () => {
    const wrapper = mount(Providers, {
      props: {
        availableProviders: [],
        showAllDistrict: false,
      },
      global: {
        components: {
          ProviderButton,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });

    let buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(0);

    await wrapper.setProps({ showAllDistrict: true });

    buttons = wrapper.findAllComponents(ProviderButton);
    expect(buttons.length).toBe(3);
  });
});
