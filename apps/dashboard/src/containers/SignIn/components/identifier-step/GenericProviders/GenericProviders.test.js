import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GenericProviders from './GenericProviders.vue';

describe('GenericProviders.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(GenericProviders);

    expect(wrapper.exists()).toBe(true);
  });

  it('should have correct container CSS classes', () => {
    const wrapper = mount(GenericProviders);

    const container = wrapper.find('div');
    expect(container.classes()).toContain('flex');
    expect(container.classes()).toContain('flex-column');
    expect(container.classes()).toContain('w-full');
    expect(container.classes()).toContain('align-content-center');
    expect(container.classes()).toContain('justify-content-center');
  });

  it('should display all provider buttons', () => {
    const wrapper = mount(GenericProviders);

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBe(3);
  });

  it('should display Clever button', () => {
    const wrapper = mount(GenericProviders);

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const cleverButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__clever-sso');
    expect(cleverButton).toBeDefined();
  });

  it('should display ClassLink button', () => {
    const wrapper = mount(GenericProviders);

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const classlinkButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__classlink-sso');
    expect(classlinkButton).toBeDefined();
  });

  it('should display NYCPS button', () => {
    const wrapper = mount(GenericProviders);

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const nycpsButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__nycps-sso');
    expect(nycpsButton).toBeDefined();
  });

  it('should emit auth-clever when Clever button clicked', async () => {
    const wrapper = mount(GenericProviders);

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const cleverButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__clever-sso');
    await cleverButton.trigger('click');

    expect(wrapper.emitted('auth-clever')).toBeTruthy();
  });

  it('should emit auth-classlink when ClassLink button clicked', async () => {
    const wrapper = mount(GenericProviders);

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const classlinkButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__classlink-sso');
    await classlinkButton.trigger('click');

    expect(wrapper.emitted('auth-classlink')).toBeTruthy();
  });

  it('should emit auth-nycps when NYCPS button clicked', async () => {
    const wrapper = mount(GenericProviders);

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    const nycpsButton = buttons.find((btn) => btn.attributes('data-cy') === 'sign-in__nycps-sso');
    await nycpsButton.trigger('click');

    expect(wrapper.emitted('auth-nycps')).toBeTruthy();
  });

  it('should have correct button data-cy attributes', () => {
    const wrapper = mount(GenericProviders);

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons[0].attributes('data-cy')).toBe('sign-in__clever-sso');
    expect(buttons[1].attributes('data-cy')).toBe('sign-in__classlink-sso');
    expect(buttons[2].attributes('data-cy')).toBe('sign-in__nycps-sso');
  });

  it('should have correct button CSS classes', () => {
    const wrapper = mount(GenericProviders);

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
    const wrapper = mount(GenericProviders);

    const images = wrapper.findAll('img');
    expect(images.length).toBe(3);
  });

  it('should have correct image alt text', () => {
    const wrapper = mount(GenericProviders);

    const images = wrapper.findAll('img');
    expect(images[0].attributes('alt')).toBe('The Clever Logo');
    expect(images[1].attributes('alt')).toBe('The ClassLink Logo');
    expect(images[2].attributes('alt')).toBe('The NYC Public Schools Logo');
  });

  it('should have correct image CSS classes', () => {
    const wrapper = mount(GenericProviders);

    const images = wrapper.findAll('img');
    images.forEach((img) => {
      expect(img.classes()).toContain('flex');
      expect(img.classes()).toContain('p-1');
      expect(img.classes()).toContain('w-1');
    });
  });

  it('should display provider names in buttons', () => {
    const wrapper = mount(GenericProviders);

    const spans = wrapper.findAll('span');
    expect(spans.some((span) => span.text().includes('Clever'))).toBe(true);
    expect(spans.some((span) => span.text().includes('ClassLink'))).toBe(true);
    expect(spans.some((span) => span.text().includes('NYCPS'))).toBe(true);
  });
});
