import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import IdentifierInput from './IdentifierInput.vue';

describe('IdentifierInput.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should render input field', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    expect(input.exists()).toBe(true);
  });

  it('should have data-cy attribute', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    expect(input.attributes('data-cy')).toBe('sign-in__username');
  });

  it('should display model value', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: 'test@example.com',
        invalid: false,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    expect(input.props('modelValue')).toBe('test@example.com');
  });

  it('should emit update:modelValue when input changes', async () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    await input.vm.$emit('update:model-value', 'newemail@example.com');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['newemail@example.com']);
  });

  it('should not display error message when invalid is false', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const message = wrapper.findComponent({ name: 'Message' });
    expect(message.exists()).toBe(false);
  });

  it('should display error message when invalid is true', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: true,
      },
    });

    const message = wrapper.findComponent({ name: 'Message' });
    expect(message.exists()).toBe(true);
  });

  it('should apply invalid class when invalid is true', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: true,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    expect(input.classes()).toContain('p-invalid');
  });

  it('should not apply invalid class when invalid is false', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    expect(input.classes()).not.toContain('p-invalid');
  });

  it('should have full width class', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    expect(input.classes()).toContain('w-full');
  });

  it('should have border-200 class', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    expect(input.classes()).toContain('border-200');
  });

  it('should render float label', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const floatLabel = wrapper.findComponent({ name: 'FloatLabel' });
    expect(floatLabel.exists()).toBe(true);
  });

  it('should have aria-describedby attribute', () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    const input = wrapper.findComponent({ name: 'InputText' });
    expect(input.attributes('aria-describedby')).toBe('email-error');
  });

  it('should update when props change', async () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: 'old@example.com',
        invalid: false,
      },
    });

    let input = wrapper.findComponent({ name: 'InputText' });
    expect(input.props('modelValue')).toBe('old@example.com');

    await wrapper.setProps({ modelValue: 'new@example.com' });

    input = wrapper.findComponent({ name: 'InputText' });
    expect(input.props('modelValue')).toBe('new@example.com');
  });

  it('should toggle error message visibility', async () => {
    const wrapper = mount(IdentifierInput, {
      props: {
        modelValue: '',
        invalid: false,
      },
    });

    let message = wrapper.findComponent({ name: 'Message' });
    expect(message.exists()).toBe(false);

    await wrapper.setProps({ invalid: true });

    message = wrapper.findComponent({ name: 'Message' });
    expect(message.exists()).toBe(true);
  });
});
