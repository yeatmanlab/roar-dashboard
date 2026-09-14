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
    expect(form.errors.value.email).toBe('Enter your email address.');
    expect(form.touched).toEqual({ firstName: true, lastName: true, email: true, password: true });
    expect(form.values).not.toHaveProperty('unknown');
  });
});
