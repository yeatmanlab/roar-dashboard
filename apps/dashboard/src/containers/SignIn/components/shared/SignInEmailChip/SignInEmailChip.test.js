import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SignInEmailChip from './SignInEmailChip.vue';

describe('SignInEmailChip.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'test@example.com',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('should display email in chip', () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'test@example.com',
      },
    });

    const chip = wrapper.findComponent({ name: 'Chip' });
    expect(chip.props('label')).toBe('test@example.com');
  });

  it('should have correct container CSS classes', () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'test@example.com',
      },
    });

    const container = wrapper.find('div');
    expect(container.classes()).toContain('w-full');
    expect(container.classes()).toContain('flex');
    expect(container.classes()).toContain('justify-content-center');
    expect(container.classes()).toContain('align-items-center');
  });

  it('should have removable chip', () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'test@example.com',
      },
    });

    const chip = wrapper.findComponent({ name: 'Chip' });
    expect(chip.props('removable')).toBe(true);
  });

  it('should emit remove event when chip remove button clicked', async () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'test@example.com',
      },
    });

    const chip = wrapper.findComponent({ name: 'Chip' });
    await chip.vm.$emit('remove');

    expect(wrapper.emitted('remove')).toBeTruthy();
  });

  it('should display different emails', () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'different@example.com',
      },
    });

    const chip = wrapper.findComponent({ name: 'Chip' });
    expect(chip.props('label')).toBe('different@example.com');
  });

  it('should update email when prop changes', async () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'original@example.com',
      },
    });

    let chip = wrapper.findComponent({ name: 'Chip' });
    expect(chip.props('label')).toBe('original@example.com');

    await wrapper.setProps({ email: 'updated@example.com' });

    chip = wrapper.findComponent({ name: 'Chip' });
    expect(chip.props('label')).toBe('updated@example.com');
  });

  it('should have chip with correct CSS classes', () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'test@example.com',
      },
    });

    const chip = wrapper.findComponent({ name: 'Chip' });
    expect(chip.classes()).toContain('flex');
    expect(chip.classes()).toContain('justify-content-center');
    expect(chip.classes()).toContain('align-items-center');
  });

  it('should have user icon image', () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'test@example.com',
      },
    });

    const chip = wrapper.findComponent({ name: 'Chip' });
    expect(chip.props('image')).toBeDefined();
  });

  it('should handle email with special characters', () => {
    const wrapper = mount(SignInEmailChip, {
      props: {
        email: 'test+tag@example.co.uk',
      },
    });

    const chip = wrapper.findComponent({ name: 'Chip' });
    expect(chip.props('label')).toBe('test+tag@example.co.uk');
  });
});
