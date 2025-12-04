import { describe, it, expect } from 'vitest';
import { useSignInForm } from './useSignInForm';

describe('useSignInForm', () => {
  it('should initialize with default values', () => {
    const form = useSignInForm();

    expect(form.email.value).toBe('');
    expect(form.password.value).toBe('');
    expect(form.invalid.value).toBe(false);
    expect(form.showPasswordField.value).toBe(false);
    expect(form.multipleProviders.value).toBe(false);
    expect(form.emailLinkSent.value).toBe(false);
    expect(form.hideProviders.value).toBe(false);
    expect(form.spinner.value).toBe(false);
    expect(form.availableProviders.value).toEqual([]);
    expect(form.hasCheckedProviders.value).toBe(false);
  });

  it('should update email correctly', () => {
    const form = useSignInForm();

    form.onEmailUpdate('test@example.com');
    expect(form.email.value).toBe('test@example.com');
  });

  it('should trim email input', () => {
    const form = useSignInForm();

    form.onEmailUpdate('  test@example.com  ');
    expect(form.email.value).toBe('test@example.com');
  });

  it('should handle null email input', () => {
    const form = useSignInForm();

    form.onEmailUpdate(null);
    expect(form.email.value).toBe('');
  });

  it('should update password correctly', () => {
    const form = useSignInForm();

    form.onPasswordUpdate('myPassword123');
    expect(form.password.value).toBe('myPassword123');
  });

  it('should handle null password input', () => {
    const form = useSignInForm();

    form.onPasswordUpdate(null);
    expect(form.password.value).toBe('');
  });

  it('should compute isUsername correctly for email', () => {
    const form = useSignInForm();

    form.onEmailUpdate('test@example.com');
    expect(form.isUsername.value).toBe(false);
  });

  it('should compute isUsername correctly for username', () => {
    const form = useSignInForm();

    form.onEmailUpdate('testuser');
    expect(form.isUsername.value).toBe(true);
  });

  it('should compute isUsername as false for empty email', () => {
    const form = useSignInForm();

    expect(form.isUsername.value).toBe(false);
  });

  it('should compute canContinue correctly', () => {
    const form = useSignInForm();

    expect(form.canContinue.value).toBe(true);

    form.multipleProviders.value = true;
    expect(form.canContinue.value).toBe(false);

    form.multipleProviders.value = false;
    form.emailLinkSent.value = true;
    expect(form.canContinue.value).toBe(false);
  });

  it('should reset all form state', () => {
    const form = useSignInForm();

    form.email.value = 'test@example.com';
    form.password.value = 'password123';
    form.invalid.value = true;
    form.showPasswordField.value = true;
    form.multipleProviders.value = true;
    form.emailLinkSent.value = true;
    form.hideProviders.value = true;
    form.spinner.value = true;
    form.availableProviders.value = ['google', 'clever'];
    form.hasCheckedProviders.value = true;

    form.resetSignInUI();

    expect(form.email.value).toBe('');
    expect(form.password.value).toBe('');
    expect(form.invalid.value).toBe(false);
    expect(form.showPasswordField.value).toBe(false);
    expect(form.multipleProviders.value).toBe(false);
    expect(form.emailLinkSent.value).toBe(false);
    expect(form.hideProviders.value).toBe(false);
    expect(form.spinner.value).toBe(false);
    expect(form.availableProviders.value).toEqual([]);
    expect(form.hasCheckedProviders.value).toBe(false);
  });

  it('should handle continueClick when not showing password field', () => {
    const form = useSignInForm();
    let emittedEvent = null;
    let emittedValue = null;

    const mockEmit = (event, value) => {
      emittedEvent = event;
      emittedValue = value;
    };

    form.email.value = 'test@example.com';
    form.continueClick(mockEmit);

    expect(emittedEvent).toBe('check-providers');
    expect(emittedValue).toBe('test@example.com');
  });

  it('should handle continueClick when showing password field', () => {
    const form = useSignInForm();
    let emittedEvent = null;

    const mockEmit = (event) => {
      emittedEvent = event;
    };

    form.showPasswordField.value = true;
    form.continueClick(mockEmit);

    expect(emittedEvent).toBe('submit');
  });

  it('should handle continueClick with undefined emit', () => {
    const form = useSignInForm();

    expect(() => {
      form.continueClick(undefined);
    }).not.toThrow();
  });
});
