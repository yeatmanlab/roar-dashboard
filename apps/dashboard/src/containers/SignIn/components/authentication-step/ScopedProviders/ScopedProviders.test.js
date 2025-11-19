import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ScopedProviders from './ScopedProviders.vue';

describe('ScopedProviders.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: [],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should have correct container CSS classes', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: [],
      },
    });

    const container = wrapper.find('div');
    expect(container.classes()).toContain('flex');
    expect(container.classes()).toContain('flex-column');
    expect(container.classes()).toContain('w-full');
    expect(container.classes()).toContain('align-content-center');
    expect(container.classes()).toContain('justify-content-center');
  });

  it('should display Google button when google in availableProviders', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const googleButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__google-sso');
    expect(googleButton).toBeDefined();
  });

  it('should display Clever button when clever in availableProviders', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['clever'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const cleverButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__clever-sso-scoped');
    expect(cleverButton).toBeDefined();
  });

  it('should display ClassLink button when classlink in availableProviders', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['classlink'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const classlinkButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__classlink-sso-scoped');
    expect(classlinkButton).toBeDefined();
  });

  it('should display NYCPS button when nycps in availableProviders', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['nycps'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const nycpsButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__nycps-sso-scoped');
    expect(nycpsButton).toBeDefined();
  });

  it('should display multiple buttons when multiple providers available', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBe(4);
  });

  it('should not display buttons when providers are not in availableProviders', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: [],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBe(0);
  });

  it('should emit auth-google when Google button clicked', async () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google'],
      },
    });

    const googleButton = wrapper.findComponent({ name: 'Button' });
    await googleButton.trigger('click');

    expect(wrapper.emitted('auth-google')).toBeTruthy();
  });

  it('should emit auth-clever when Clever button clicked', async () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['clever'],
      },
    });

    const cleverButton = wrapper.findComponent({ name: 'Button' });
    await cleverButton.trigger('click');

    expect(wrapper.emitted('auth-clever')).toBeTruthy();
  });

  it('should emit auth-classlink when ClassLink button clicked', async () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['classlink'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const classlinkButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__classlink-sso-scoped');
    await classlinkButton.trigger('click');

    expect(wrapper.emitted('auth-classlink')).toBeTruthy();
  });

  it('should emit auth-nycps when NYCPS button clicked', async () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['nycps'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const nycpsButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__nycps-sso-scoped');
    await nycpsButton.trigger('click');

    expect(wrapper.emitted('auth-nycps')).toBeTruthy();
  });

  it('should have correct button data-cy attributes', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons[0].attributes('data-cy')).toBe('sign-in__google-sso');
    expect(buttons[1].attributes('data-cy')).toBe('sign-in__clever-sso-scoped');
    expect(buttons[2].attributes('data-cy')).toBe('sign-in__classlink-sso-scoped');
    expect(buttons[3].attributes('data-cy')).toBe('sign-in__nycps-sso-scoped');
  });

  it('should have correct button CSS classes', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    buttons.forEach((btn) => {
      expect(btn.classes()).toContain('flex');
      expect(btn.classes()).toContain('h-1');
      expect(btn.classes()).toContain('m-1');
      expect(btn.classes()).toContain('w-full');
      expect(btn.classes()).toContain('surface-0');
      expect(btn.classes()).toContain('border-200');
      expect(btn.classes()).toContain('border-1');
      expect(btn.classes()).toContain('border-round-md');
      expect(btn.classes()).toContain('justify-content-center');
      expect(btn.classes()).toContain('hover:border-primary');
      expect(btn.classes()).toContain('hover:surface-ground');
      expect(btn.classes()).toContain('provider-button');
    });
  });

  it('should display provider logos', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
      },
    });

    const images = wrapper.findAll('img');
    expect(images.length).toBe(4);
  });

  it('should have correct image alt text', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
      },
    });

    const images = wrapper.findAll('img');
    expect(images[0].attributes('alt')).toBe('The Google Logo');
    expect(images[1].attributes('alt')).toBe('The Clever Logo');
    expect(images[2].attributes('alt')).toBe('The ClassLink Logo');
    expect(images[3].attributes('alt')).toBe('The NYC Public Schools Logo');
  });

  it('should have correct image CSS classes', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
      },
    });

    const images = wrapper.findAll('img');
    images.forEach((img) => {
      expect(img.classes()).toContain('flex');
      expect(img.classes()).toContain('p-1');
      expect(img.classes()).toContain('w-1');
    });
  });

  it('should display provider names in buttons', () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['google', 'clever', 'classlink', 'nycps'],
      },
    });

    const spans = wrapper.findAll('span');
    expect(spans.some((span) => span.text().includes('Google'))).toBe(true);
    expect(spans.some((span) => span.text().includes('Clever'))).toBe(true);
    expect(spans.some((span) => span.text().includes('ClassLink'))).toBe(true);
    expect(spans.some((span) => span.text().includes('NYCPS'))).toBe(true);
  });

  it('should show only specified providers when availableProviders is set', async () => {
    const wrapper = mount(ScopedProviders, {
      props: {
        availableProviders: ['clever'],
      },
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBe(1);
    expect(buttons[0].attributes('data-cy')).toBe('sign-in__clever-sso-scoped');
  });
});
