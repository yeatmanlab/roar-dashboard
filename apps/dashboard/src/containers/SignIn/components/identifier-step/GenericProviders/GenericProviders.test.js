import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GenericProviders from './GenericProviders.vue';

describe('GenericProviders.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: false,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should have correct container CSS classes', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: false,
        showScopedProviders: false,
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

  it('should not display Google button when showGenericProviders is false and google not in availableProviders', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: false,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(false);
  });

  it('should display Google button when showGenericProviders is true', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(true);
  });

  it('should display Google button when showScopedProviders is true and google in availableProviders', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: false,
        showScopedProviders: true,
        availableProviders: ['google'],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(true);
  });

  it('should have data-cy attribute on button', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.attributes('data-cy')).toBe('sign-in__google-sso');
  });

  it('should have correct button CSS classes', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('flex');
    expect(button.classes()).toContain('h-1');
    expect(button.classes()).toContain('m-1');
    expect(button.classes()).toContain('w-full');
    expect(button.classes()).toContain('text-black');
    expect(button.classes()).toContain('surface-0');
    expect(button.classes()).toContain('border-200');
    expect(button.classes()).toContain('border-1');
    expect(button.classes()).toContain('border-round-md');
    expect(button.classes()).toContain('justify-content-center');
  });

  it('should have hover classes on button', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('hover:border-primary');
    expect(button.classes()).toContain('hover:surface-ground');
  });

  it('should have provider-button class', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('provider-button');
  });

  it('should display Google logo image', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('alt')).toBe('The Google Logo');
  });

  it('should have correct image CSS classes', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const img = wrapper.find('img');
    expect(img.classes()).toContain('flex');
    expect(img.classes()).toContain('p-1');
    expect(img.classes()).toContain('w-1');
  });

  it('should display button text', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const span = wrapper.find('span');
    expect(span.text()).toContain('Google');
  });

  it('should emit auth-google when button clicked', async () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    await button.trigger('click');

    expect(wrapper.emitted('auth-google')).toBeTruthy();
  });

  it('should have correct inner div CSS classes', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: true,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    const innerDiv = wrapper.find('.flex.flex-row');
    expect(innerDiv.classes()).toContain('flex');
    expect(innerDiv.classes()).toContain('flex-row');
    expect(innerDiv.classes()).toContain('align-items-center');
    expect(innerDiv.classes()).toContain('w-full');
    expect(innerDiv.classes()).toContain('gap-2');
  });

  it('should not display button when all conditions are false', () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: false,
        showScopedProviders: true,
        availableProviders: ['clever'],
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(false);
  });

  it('should toggle button visibility when props change', async () => {
    const wrapper = mount(GenericProviders, {
      props: {
        showGenericProviders: false,
        showScopedProviders: false,
        availableProviders: [],
      },
    });

    let button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(false);

    await wrapper.setProps({ showGenericProviders: true });

    button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(true);
  });
});
