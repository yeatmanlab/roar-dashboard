import { describe, expect, it, vi } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import { useSelfRegistration } from './useSelfRegistration';

vi.mock('@/containers/FamilyRegistration/composables/useFamilyRegistration', () => ({
  useFamilyRegistration: vi.fn(),
}));

describe('useSelfRegistration', () => {
  it('prevents duplicate requests and holds the success state for explicit navigation', async () => {
    let resolveCreation;
    const createAccount = vi.fn(() => new Promise((resolve) => (resolveCreation = resolve)));
    const [workflow, app] = withSetup(() => useSelfRegistration({ createAccount }));

    const first = workflow.submit({ email: 'parent@example.com' });
    const second = await workflow.submit({ email: 'parent@example.com' });
    expect(second).toBe(false);
    expect(createAccount).toHaveBeenCalledTimes(1);

    resolveCreation();
    await first;
    expect(workflow.isSuccess.value).toBe(true);

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

  it('clears a dismissed error without changing verification readiness', async () => {
    const [workflow, app] = withSetup(() =>
      useSelfRegistration({ createAccount: vi.fn().mockRejectedValue(new Error('provider unavailable')) }),
    );

    workflow.setVerificationToken('verified');
    await workflow.submit({ email: 'parent@example.com' });
    workflow.dismissStatus();

    expect(workflow.verificationToken.value).toBe('verified');
    expect(workflow.isSuccess.value).toBe(false);
    expect(workflow.errorMessage.value).toBe('');
    app.unmount();
  });
});
