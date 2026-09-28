import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RegistrationSuccess from './RegistrationSuccess.vue';

describe('RegistrationSuccess.vue', () => {
  it('welcomes the owner, focuses the result heading, and links to Sign In', () => {
    const wrapper = mount(RegistrationSuccess, {
      attachTo: document.body,
      props: { firstName: ' Emily Judith ' },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.get('#self-registration-success-heading').text()).toBe('Account created');
    expect(wrapper.text()).toContain('Welcome to ROAR, Emily Judith.');
    expect(wrapper.get('.self-registration-success-action').attributes('href')).toBe('/signin');
    expect(wrapper.get('.self-registration-success-action').text()).toContain('Continue to sign in');
    expect(document.activeElement).toBe(wrapper.get('#self-registration-success-heading').element);

    wrapper.unmount();
  });
});
