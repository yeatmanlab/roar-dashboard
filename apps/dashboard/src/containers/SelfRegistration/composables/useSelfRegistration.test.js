import { afterEach, describe, expect, it, vi } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import { useSelfRegistration } from './useSelfRegistration';

vi.mock('@/containers/FamilyRegistration/composables/useFamilyRegistration', () => ({
  useFamilyRegistration: vi.fn(),
}));

describe('useSelfRegistration', () => {
  afterEach(() => vi.useRealTimers());

  it('prevents duplicate account-creation requests and redirects after success', async () => {
    vi.useFakeTimers();
    let resolveCreation;
    const createAccount = vi.fn(() => new Promise((resolve) => (resolveCreation = resolve)));
    const redirect = vi.fn();
    const [workflow, app] = withSetup(() => useSelfRegistration({ createAccount, redirect, redirectDelay: 25 }));

    const first = workflow.submit({ email: 'parent@example.com' });
    const second = await workflow.submit({ email: 'parent@example.com' });
    expect(second).toBe(false);
    expect(createAccount).toHaveBeenCalledTimes(1);

    resolveCreation();
    await first;
    expect(workflow.isSuccess.value).toBe(true);
    vi.advanceTimersByTime(25);
    expect(redirect).toHaveBeenCalledOnce();

    app.unmount();
  });

  it('maps unexpected provider failures to a stable recovery message', async () => {
    const [workflow, app] = withSetup(() =>
      useSelfRegistration({ createAccount: vi.fn().mockRejectedValue(new Error('internal provider detail')) }),
    );

    await expect(workflow.submit({ email: 'parent@example.com' })).resolves.toBe(false);
    expect(workflow.errorMessage.value).toMatch(/could not create your account/i);
    expect(workflow.errorMessage.value).not.toContain('provider detail');
    app.unmount();
  });

  it('preserves actionable duplicate-account errors', async () => {
    const duplicateError = new Error('This email address is already in use. Please sign in instead.');
    const [workflow, app] = withSetup(() =>
      useSelfRegistration({ createAccount: vi.fn().mockRejectedValue(duplicateError) }),
    );

    await expect(workflow.submit({ email: 'parent@example.com' })).resolves.toBe(false);
    expect(workflow.errorMessage.value).toBe(duplicateError.message);
    app.unmount();
  });

  it('cancels a pending redirect when the status is dismissed', async () => {
    vi.useFakeTimers();
    const redirect = vi.fn();
    const [workflow, app] = withSetup(() =>
      useSelfRegistration({ createAccount: vi.fn().mockResolvedValue(), redirect, redirectDelay: 25 }),
    );

    workflow.setVerificationToken('verified');
    await workflow.submit({ email: 'parent@example.com' });
    workflow.dismissStatus();
    vi.advanceTimersByTime(25);

    expect(workflow.verificationToken.value).toBe('verified');
    expect(workflow.isSuccess.value).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
    app.unmount();
  });
});
