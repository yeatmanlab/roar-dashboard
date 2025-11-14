import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MagicLinkSuccess from './MagicLinkSuccess.vue';

describe('MagicLinkSuccess.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(MagicLinkSuccess);

    expect(wrapper.exists()).toBe(true);
  });

  it('should have correct container CSS classes', () => {
    const wrapper = mount(MagicLinkSuccess);

    const container = wrapper.find('div');
    expect(container.classes()).toContain('flex');
    expect(container.classes()).toContain('flex-column');
    expect(container.classes()).toContain('align-items-center');
    expect(container.classes()).toContain('text-center');
    expect(container.classes()).toContain('gap-2');
  });

  it('should display heading', () => {
    const wrapper = mount(MagicLinkSuccess);

    const heading = wrapper.find('h2');
    expect(heading.exists()).toBe(true);
  });

  it('should have correct heading CSS classes', () => {
    const wrapper = mount(MagicLinkSuccess);

    const heading = wrapper.find('h2');
    expect(heading.classes()).toContain('text-xl');
    expect(heading.classes()).toContain('font-semibold');
  });

  it('should display description paragraph', () => {
    const wrapper = mount(MagicLinkSuccess);

    const paragraph = wrapper.find('p');
    expect(paragraph.exists()).toBe(true);
  });

  it('should have correct paragraph CSS classes', () => {
    const wrapper = mount(MagicLinkSuccess);

    const paragraph = wrapper.find('p');
    expect(paragraph.classes()).toContain('text-500');
  });

  it('should render a button', () => {
    const wrapper = mount(MagicLinkSuccess);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(true);
  });

  it('should have data-cy attribute on button', () => {
    const wrapper = mount(MagicLinkSuccess);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.attributes('data-cy')).toBe('signin-use-password');
  });

  it('should have correct button CSS classes', () => {
    const wrapper = mount(MagicLinkSuccess);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('mt-3');
    expect(button.classes()).toContain('w-full');
    expect(button.classes()).toContain('p-2');
    expect(button.classes()).toContain('bg-white');
    expect(button.classes()).toContain('text-500');
    expect(button.classes()).toContain('border-500');
  });

  it('should have hover classes on button', () => {
    const wrapper = mount(MagicLinkSuccess);

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('hover:bg-primary');
    expect(button.classes()).toContain('hover:border-primary');
    expect(button.classes()).toContain('hover:text-white');
  });

  it('should emit back-to-password when button clicked', async () => {
    const wrapper = mount(MagicLinkSuccess);

    const button = wrapper.findComponent({ name: 'Button' });
    await button.trigger('click');

    expect(wrapper.emitted('back-to-password')).toBeTruthy();
  });

  it('should display button text', () => {
    const wrapper = mount(MagicLinkSuccess);

    const span = wrapper.find('span');
    expect(span.exists()).toBe(true);
  });
});
