import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import { useSelfRegistration } from './useSelfRegistration';

const mocks = vi.hoisted(() => ({
  createFamily: vi.fn(),
}));

vi.mock('@/composables/mutations/useCreateFamilyMutation', () => ({
  default: () => ({ mutateAsync: mocks.createFamily }),
}));

const FORM = { email: 'parent@example.com', password: 'super-secret', firstName: 'Pat', lastName: 'Guardian' };

describe('useSelfRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createFamily.mockResolvedValue({ id: 'family-1' });
  });

  it('maps the account-owner form into the strict family-creation payload', async () => {
    const [workflow, app] = withSetup(() => useSelfRegistration());

    await expect(workflow.submit(FORM)).resolves.toBe(true);

    expect(mocks.createFamily).toHaveBeenCalledWith({
      body: {
        email: 'parent@example.com',
        password: 'super-secret',
        name: { first: 'Pat', last: 'Guardian' },
      },
    });
    expect(workflow.isSuccess.value).toBe(true);
    app.unmount();
  });

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

  it.each([
    [409, 'This email address is already in use. Please sign in instead.'],
    [422, 'An account already exists for this email. Please sign in to access your account.'],
  ])('maps a %s response to an actionable account error', async (status, expectedMessage) => {
    mocks.createFamily.mockRejectedValue({ status });
    const [workflow, app] = withSetup(() => useSelfRegistration());

    await expect(workflow.submit(FORM)).resolves.toBe(false);
    expect(workflow.errorMessage.value).toBe(expectedMessage);
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
