import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AccountOwnerForm from './AccountOwnerForm.vue';
import { useAccountOwnerForm } from '../composables/useAccountOwnerForm';

vi.mock('vue-recaptcha', () => ({
  ChallengeV3: { name: 'ChallengeV3', template: '<div><slot /></div>' },
}));

const emptyValues = { firstName: '', lastName: '', email: '', password: '' };
const emptyErrors = { firstName: '', lastName: '', email: '', password: '' };
const untouched = { firstName: false, lastName: false, email: false, password: false };

function mountForm(props = {}) {
  return mount(AccountOwnerForm, {
    attachTo: document.body,
    props: {
      values: { ...emptyValues },
      errors: { ...emptyErrors },
      touched: { ...untouched },
      ...props,
    },
    global: {
      stubs: {
        ChallengeV3: { template: '<div><slot /></div>' },
        RouterLink: { template: '<a href="/signin"><slot /></a>' },
      },
    },
  });
}

describe('AccountOwnerForm.vue', () => {
  it('renders the approved field order, labels, examples, and password guidance', () => {
    const wrapper = mountForm();
    const accountFields = wrapper.findAll('input').filter((field) => field.attributes('type') !== 'checkbox');

    expect(accountFields.map((field) => field.attributes('name'))).toEqual([
      'firstName',
      'lastName',
      'email',
      'password',
    ]);
    expect(accountFields.map((field) => field.attributes('placeholder'))).toEqual([
      'Name',
      'Last Name',
      'you@email.org',
      'Create a password',
    ]);
    expect(wrapper.get('[for="account-owner-first-name"]').text()).toContain('First name');
    expect(wrapper.get('[for="account-owner-last-name"]').text()).toContain('Last name');
    expect(wrapper.get('[for="account-owner-email"]').text()).toContain('Email address');
    expect(wrapper.get('[for="account-owner-password"]').text()).toContain('Password');
    expect(wrapper.get('#account-owner-password-help').text()).toBe('Must be at least 8 characters.');

    wrapper.unmount();
  });

  it('does not render invitation or registration-code fields during owner signup', () => {
    const wrapper = mountForm();

    expect(wrapper.find('[name="code"], [name="invitationCode"], [name="activationCode"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('keeps legal acceptance, research consent, and optional contact as separate controls', async () => {
    const wrapper = mountForm();

    expect(wrapper.get('[name="legalAcceptance"]').exists()).toBe(true);
    expect(wrapper.get('[name="futureContact"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="research-consent-status"]').text()).toContain('Research consent required');

    await wrapper.get('[name="legalAcceptance"]').setValue(true);
    await wrapper.get('.self-registration-consent-action').trigger('click');

    expect(wrapper.emitted('update:legal-accepted')).toContainEqual([true]);
    expect(wrapper.emitted('review-research-consent')).toHaveLength(1);
    expect(wrapper.emitted('update:future-contact-allowed')).toBeUndefined();
    wrapper.unmount();
  });

  it('emits controlled field updates and uses the native form submission path', async () => {
    const wrapper = mountForm();

    await wrapper.get('#account-owner-email').setValue('owner@example.com');
    await wrapper.get('#account-owner-email').trigger('blur');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('update:field')).toContainEqual(['email', 'owner@example.com']);
    expect(wrapper.emitted('touch')).toContainEqual(['email']);
    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.get('[data-cy="signup__create-account"]').attributes('type')).toBe('submit');

    wrapper.unmount();
  });

  it('toggles password visibility without changing the password value', async () => {
    const wrapper = mountForm({ values: { ...emptyValues, password: 'safe-password' } });
    const password = wrapper.get('#account-owner-password');
    const toggle = wrapper.get('[aria-label="Show password"]');

    expect(password.attributes('type')).toBe('password');
    expect(password.element.value).toBe('safe-password');

    await toggle.trigger('click');

    expect(password.attributes('type')).toBe('text');
    expect(password.element.value).toBe('safe-password');
    expect(wrapper.get('[aria-label="Hide password"]').attributes('aria-pressed')).toBe('true');

    wrapper.unmount();
  });

  it('links errors to their fields and focuses the first invalid field on submission', async () => {
    const wrapper = mountForm({
      errors: {
        firstName: 'Enter your first name.',
        lastName: 'Enter your last name.',
        email: 'Enter your email address.',
        password: 'Create a password.',
      },
      submitted: true,
    });

    await wrapper.get('form').trigger('submit');

    expect(document.activeElement).toBe(wrapper.get('#account-owner-first-name').element);
    expect(wrapper.get('#account-owner-first-name').attributes('aria-describedby')).toBe(
      'account-owner-first-name-error',
    );
    expect(wrapper.get('#account-owner-first-name-error').text()).toBe('Enter your first name.');

    wrapper.unmount();
  });

  it('removes a stale field error when corrected values are supplied', async () => {
    const wrapper = mountForm({
      errors: { ...emptyErrors, email: 'Enter a valid email address, such as you@example.com.' },
      touched: { ...untouched, email: true },
    });

    expect(wrapper.find('#account-owner-email-error').exists()).toBe(true);

    await wrapper.setProps({
      values: { ...emptyValues, email: 'owner@example.com' },
      errors: { ...emptyErrors },
    });

    expect(wrapper.find('#account-owner-email-error').exists()).toBe(false);
    expect(wrapper.get('#account-owner-email').attributes('aria-invalid')).toBe('false');

    wrapper.unmount();
  });
});

describe('account-owner form validation', () => {
  it('distinguishes a missing email from an invalid email and accepts the API password minimum', () => {
    const form = useAccountOwnerForm();

    expect(form.errors.value.email).toBe('Enter your email address.');
    expect(form.errors.value.password).toBe('Create a password.');

    form.setField('email', 'owner@invalid');
    form.setField('password', 'short');
    expect(form.errors.value.email).toBe('Enter a valid email address, such as you@example.com.');
    expect(form.errors.value.password).toBe('Use at least 8 characters for your password.');

    form.setField('email', 'owner@example.com');
    form.setField('password', '12345678');
    expect(form.errors.value.email).toBe('');
    expect(form.errors.value.password).toBe('');
  });
});
