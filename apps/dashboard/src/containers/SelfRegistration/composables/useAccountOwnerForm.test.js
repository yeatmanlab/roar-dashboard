import { describe, expect, it } from 'vitest';
import { useAccountOwnerForm } from './useAccountOwnerForm';

describe('useAccountOwnerForm', () => {
  it('normalizes form values into an account-only payload', () => {
    const form = useAccountOwnerForm();
    form.setValues({
      firstName: ' Pat ',
      lastName: ' Guardian ',
      email: 'parent@example.com ',
      password: 'password1',
    });

    expect(form.validate()).toBe(true);
    expect(form.payload.value).toEqual({
      firstName: 'Pat',
      lastName: 'Guardian',
      email: 'parent@example.com',
      password: 'password1',
    });
  });

  it('rejects incomplete values and ignores unknown fields', () => {
    const form = useAccountOwnerForm();
    form.setField('firstName', 'Pat');
    form.setField('unknown', 'not allowed');

    expect(form.validate()).toBe(false);
    expect(form.errors.value.email).toBe('Enter a complete email address.');
    expect(form.touched).toEqual({ firstName: true, lastName: true, email: true, password: true });
    expect(form.values).not.toHaveProperty('unknown');
  });

  it.each([
    ['firstName', ' ', 'Enter your first name.'],
    ['lastName', ' ', 'Enter your last name.'],
    ['email', 'not-an-email', 'Enter a complete email address.'],
    ['password', '1234567', 'Use at least 8 characters for your password.'],
  ])('uses Vuelidate rules for an invalid %s', (field, value, message) => {
    const form = useAccountOwnerForm();
    form.setValues({
      firstName: 'Pat',
      lastName: 'Guardian',
      email: 'parent@example.com',
      password: 'password1',
      [field]: value,
    });

    expect(form.validate()).toBe(false);
    expect(form.errors.value[field]).toBe(message);
  });

  it('clears stale validation messages when a field is corrected', () => {
    const form = useAccountOwnerForm();
    form.touch('email');

    expect(form.errors.value.email).toBe('Enter a complete email address.');

    form.setField('email', 'parent@example.com');

    expect(form.errors.value.email).toBe('');
  });
});
