import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MagicLinkBackButton from './MagicLinkBackButton.vue';

describe('MagicLinkBackButton.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(MagicLinkBackButton);

    expect(wrapper.exists()).toBe(true);
  });

  it('should render a button', () => {
    const wrapper = mount(MagicLinkBackButton);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(true);
  });

  it('should have data-cy attribute', () => {
    const wrapper = mount(MagicLinkBackButton);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.attributes('data-cy')).toBe('signin-use-password');
  });

  it('should have correct CSS classes', () => {
    const wrapper = mount(MagicLinkBackButton);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('mt-3');
    expect(button.classes()).toContain('w-full');
    expect(button.classes()).toContain('p-0');
    expect(button.classes()).toContain('bg-white');
    expect(button.classes()).toContain('text-500');
    expect(button.classes()).toContain('border-500');
  });

  it('should have hover classes', () => {
    const wrapper = mount(MagicLinkBackButton);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('hover:bg-primary');
    expect(button.classes()).toContain('hover:border-primary');
    expect(button.classes()).toContain('hover:text-white');
  });

  it('should emit back-to-password when clicked', async () => {
    const wrapper = mount(MagicLinkBackButton);

    const button = wrapper.findComponent({ name: 'Button' });
    await button.trigger('click');

    expect(wrapper.emitted('back-to-password')).toBeTruthy();
  });

  it('should display button text', () => {
    const wrapper = mount(MagicLinkBackButton);

    const span = wrapper.find('span');
    expect(span.exists()).toBe(true);
  });

  it('should have padding class', () => {
    const wrapper = mount(MagicLinkBackButton);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('p-2');
  });
});
