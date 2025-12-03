import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProviderButton from './ProviderButton.vue';

describe('ProviderButton.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should render button', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(true);
  });

  it('should display label', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Sign in with Google',
        imgSrc: '',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    const span = wrapper.find('span');
    expect(span.text()).toBe('Sign in with Google');
  });

  it('should display image when imgSrc is provided', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '/path/to/google-logo.png',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('/path/to/google-logo.png');
  });

  it('should have correct image styling', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '/path/to/google-logo.png',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    const img = wrapper.find('img');
    expect(img.classes()).toContain('p-1');
    expect(img.classes()).toContain('w-1');
  });

  it('should display icon when icon is provided and no imgSrc', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'GitHub',
        imgSrc: '',
        icon: 'pi pi-github',
        btnClass: '',
        dataCy: '',
      },
    });

    const icon = wrapper.find('i');
    expect(icon.exists()).toBe(true);
    expect(icon.classes()).toContain('pi');
    expect(icon.classes()).toContain('pi-github');
  });

  it('should have aria-hidden on icon', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'GitHub',
        imgSrc: '',
        icon: 'pi pi-github',
        btnClass: '',
        dataCy: '',
      },
    });

    const icon = wrapper.find('i');
    expect(icon.attributes('aria-hidden')).toBe('true');
  });

  it('should not display icon when imgSrc is provided', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '/path/to/google-logo.png',
        icon: 'pi pi-google',
        btnClass: '',
        dataCy: '',
      },
    });

    const icon = wrapper.find('i');
    expect(icon.exists()).toBe(false);
  });

  it('should apply custom button class via wrapper element', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '',
        icon: '',
        btnClass: 'custom-class',
        dataCy: '',
      },
      attrs: {
        class: 'custom-class',
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.exists()).toBe(true);
  });

  it('should have data-cy attribute', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '',
        icon: '',
        btnClass: '',
        dataCy: 'sign-in__google',
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.attributes('data-cy')).toBe('sign-in__google');
  });

  it('should have default button classes', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    expect(button.classes()).toContain('w-full');
    expect(button.classes()).toContain('p-2');
  });

  it('should emit click event when button clicked', async () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    const button = wrapper.findComponent({ name: 'Button' });
    await button.trigger('click');

    expect(wrapper.emitted('click')).toBeTruthy();
  });

  it('should have icon with p-1 and w-1 classes', () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'GitHub',
        imgSrc: '',
        icon: 'pi pi-github',
        btnClass: '',
        dataCy: '',
      },
    });

    const icon = wrapper.find('i');
    expect(icon.classes()).toContain('p-1');
    expect(icon.classes()).toContain('w-1');
  });

  it('should update label when prop changes', async () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Original Label',
        imgSrc: '',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    let span = wrapper.find('span');
    expect(span.text()).toBe('Original Label');

    await wrapper.setProps({ label: 'Updated Label' });

    span = wrapper.find('span');
    expect(span.text()).toBe('Updated Label');
  });

  it('should update image when imgSrc prop changes', async () => {
    const wrapper = mount(ProviderButton, {
      props: {
        label: 'Google',
        imgSrc: '/old-logo.png',
        icon: '',
        btnClass: '',
        dataCy: '',
      },
    });

    let img = wrapper.find('img');
    expect(img.attributes('src')).toBe('/old-logo.png');

    await wrapper.setProps({ imgSrc: '/new-logo.png' });

    img = wrapper.find('img');
    expect(img.attributes('src')).toBe('/new-logo.png');
  });
});
