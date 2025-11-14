import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SignInCard from './SignInCard.vue';

describe('SignInCard.vue', () => {
  it('should render the component', () => {
    const wrapper = mount(SignInCard);

    expect(wrapper.exists()).toBe(true);
  });

  it('should have correct CSS classes', () => {
    const wrapper = mount(SignInCard);

    const card = wrapper.find('div');
    expect(card.classes()).toContain('bg-white');
    expect(card.classes()).toContain('border');
    expect(card.classes()).toContain('rounded-2xl');
    expect(card.classes()).toContain('p-4');
    expect(card.classes()).toContain('shadow-1');
  });

  it('should render slot content', () => {
    const wrapper = mount(SignInCard, {
      slots: {
        default: '<p>Test content</p>',
      },
    });

    expect(wrapper.html()).toContain('Test content');
  });

  it('should render multiple slot elements', () => {
    const wrapper = mount(SignInCard, {
      slots: {
        default: '<p>First</p><p>Second</p>',
      },
    });

    expect(wrapper.html()).toContain('First');
    expect(wrapper.html()).toContain('Second');
  });

  it('should have responsive padding', () => {
    const wrapper = mount(SignInCard);

    const card = wrapper.find('div');
    expect(card.classes()).toContain('md:p-5');
  });
});
