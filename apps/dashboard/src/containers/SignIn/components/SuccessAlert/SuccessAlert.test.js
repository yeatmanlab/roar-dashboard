import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SuccessAlert from './SuccessAlert.vue';

describe('SuccessAlert.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: false,
        title: 'Success',
        description: '',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should not display Alert when show is false', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: false,
        title: 'Success',
        description: 'Operation completed',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.exists()).toBe(false);
  });

  it('should display Alert when show is true', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success',
        description: 'Operation completed',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.exists()).toBe(true);
  });

  it('should pass variant success to Alert', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success',
        description: 'Operation completed',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.props('variant')).toBe('success');
  });

  it('should display title in AlertTitle', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success Title',
        description: 'Success description',
      },
    });

    const alertTitle = wrapper.findComponent({ name: 'AlertTitle' });
    expect(alertTitle.text()).toContain('Success Title');
  });

  it('should display description in AlertDescription', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success',
        description: 'Success description text',
      },
    });

    const alertDescription = wrapper.findComponent({ name: 'AlertDescription' });
    expect(alertDescription.text()).toContain('Success description text');
  });

  it('should render slot content if provided', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success',
        description: 'Default description',
      },
      slots: {
        default: '<span>Custom slot content</span>',
      },
    });

    expect(wrapper.html()).toContain('Custom slot content');
  });

  it('should use description when no slot provided', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success',
        description: 'Description from props',
      },
    });

    expect(wrapper.html()).toContain('Description from props');
  });

  it('should have full width class', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success',
        description: 'Success',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.classes()).toContain('w-full');
  });

  it('should have bottom margin class', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success',
        description: 'Success',
      },
    });

    const alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.classes()).toContain('mb-2');
  });

  it('should toggle visibility when show prop changes', async () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: false,
        title: 'Success',
        description: 'Success',
      },
    });

    let alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.exists()).toBe(false);

    await wrapper.setProps({ show: true });

    alert = wrapper.findComponent({ name: 'Alert' });
    expect(alert.exists()).toBe(true);
  });

  it('should update title when prop changes', async () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Original Title',
        description: 'Success',
      },
    });

    let alertTitle = wrapper.findComponent({ name: 'AlertTitle' });
    expect(alertTitle.text()).toContain('Original Title');

    await wrapper.setProps({ title: 'Updated Title' });

    alertTitle = wrapper.findComponent({ name: 'AlertTitle' });
    expect(alertTitle.text()).toContain('Updated Title');
  });

  it('should update description when prop changes', async () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        title: 'Success',
        description: 'Original description',
      },
    });

    let alertDescription = wrapper.findComponent({ name: 'AlertDescription' });
    expect(alertDescription.text()).toContain('Original description');

    await wrapper.setProps({ description: 'Updated description' });

    alertDescription = wrapper.findComponent({ name: 'AlertDescription' });
    expect(alertDescription.text()).toContain('Updated description');
  });

  it('should have default title of Success', () => {
    const wrapper = mount(SuccessAlert, {
      props: {
        show: true,
        description: 'Some description',
      },
    });

    const alertTitle = wrapper.findComponent({ name: 'AlertTitle' });
    expect(alertTitle.text()).toContain('Success');
  });
});
