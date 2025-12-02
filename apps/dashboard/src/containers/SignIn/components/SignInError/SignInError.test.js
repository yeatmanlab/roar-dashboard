import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SignInError from './SignInError.vue';

describe('SignInError.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: false,
        title: '',
        description: '',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should not display Alert when show is false', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: false,
        title: 'Error',
        description: 'Something went wrong',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.exists()).toBe(false);
  });

  it('should display Alert when show is true', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error',
        description: 'Something went wrong',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.exists()).toBe(true);
  });

  it('should pass variant destructive to Alert', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error',
        description: 'Something went wrong',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.props('variant')).toBe('destructive');
  });

  it('should display title in AlertTitle', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error Title',
        description: 'Error description',
      },
    });

    const alertTitle = wrapper.findComponent({ name: 'AlertTitle' });
    expect(alertTitle.text()).toContain('Error Title');
  });

  it('should display description in AlertDescription', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error',
        description: 'Error description text',
      },
    });

    const alertDescription = wrapper.findComponent({ name: 'AlertDescription' });
    expect(alertDescription.text()).toContain('Error description text');
  });

  it('should render slot content if provided', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error',
        description: 'Default description',
      },
      slots: {
        default: '<span>Custom slot content</span>',
      },
    });

    expect(wrapper.html()).toContain('Custom slot content');
  });

  it('should use description when no slot provided', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error',
        description: 'Description from props',
      },
    });

    expect(wrapper.html()).toContain('Description from props');
  });

  it('should have full width class', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error',
        description: 'Error',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.classes()).toContain('w-full');
  });

  it('should have bottom margin class', () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error',
        description: 'Error',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.classes()).toContain('mb-2');
  });

  it('should toggle visibility when show prop changes', async () => {
    const wrapper = mount(SignInError, {
      props: {
        show: false,
        title: 'Error',
        description: 'Error',
      },
    });

    let alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.exists()).toBe(false);

    await wrapper.setProps({ show: true });

    alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.exists()).toBe(true);
  });

  it('should update title when prop changes', async () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Original Title',
        description: 'Error',
      },
    });

    let alertTitle = wrapper.findComponent({ name: 'AlertTitle' });
    expect(alertTitle.text()).toContain('Original Title');

    await wrapper.setProps({ title: 'Updated Title' });

    alertTitle = wrapper.findComponent({ name: 'AlertTitle' });
    expect(alertTitle.text()).toContain('Updated Title');
  });

  it('should update description when prop changes', async () => {
    const wrapper = mount(SignInError, {
      props: {
        show: true,
        title: 'Error',
        description: 'Original description',
      },
    });

    let alertDescription = wrapper.findComponent({ name: 'AlertDescription' });
    expect(alertDescription.text()).toContain('Original description');

    await wrapper.setProps({ description: 'Updated description' });

    alertDescription = wrapper.findComponent({ name: 'AlertDescription' });
    expect(alertDescription.text()).toContain('Updated description');
  });
});
