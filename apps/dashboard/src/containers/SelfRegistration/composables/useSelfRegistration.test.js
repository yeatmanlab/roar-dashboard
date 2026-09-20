import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import { ACCOUNT_CREATION_ERROR_MESSAGE } from '@/constants/auth';
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

  it('prevents duplicate account-creation requests and exposes success after creation', async () => {
    let resolveCreation;
    const createAccount = vi.fn(() => new Promise((resolve) => (resolveCreation = resolve)));
    const [workflow, app] = withSetup(() => useSelfRegistration({ createAccount }));

    const first = workflow.submit(FORM);
    const second = await workflow.submit(FORM);

    expect(second).toBe(false);
    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(workflow.isSuccess.value).toBe(false);

    resolveCreation();
    await first;
    expect(workflow.isSuccess.value).toBe(true);
    app.unmount();
  });

  it.each([
    new Error('internal provider detail'),
    Object.assign(new Error('This email address is already in use.'), { status: 409 }),
    Object.assign(new Error('An account already exists.'), { status: 422 }),
  ])('maps account-creation failures to neutral recovery guidance', async (providerError) => {
    const [workflow, app] = withSetup(() =>
      useSelfRegistration({ createAccount: vi.fn().mockRejectedValue(providerError) }),
    );

    await expect(workflow.submit(FORM)).resolves.toBe(false);
    expect(workflow.errorMessage.value).toBe(ACCOUNT_CREATION_ERROR_MESSAGE);
    expect(workflow.errorMessage.value).not.toMatch(/provider|already|exists|in use/i);
    app.unmount();
  });

  it('dismisses account-creation errors', async () => {
    const [workflow, app] = withSetup(() =>
      useSelfRegistration({ createAccount: vi.fn().mockRejectedValue(new Error('provider failure')) }),
    );

    await workflow.submit(FORM);
    workflow.dismissError();

    expect(workflow.errorMessage.value).toBe('');
    app.unmount();
  });
});
