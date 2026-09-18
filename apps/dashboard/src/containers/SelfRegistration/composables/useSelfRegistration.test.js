import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import { ACCOUNT_CREATION_ERROR_MESSAGE } from '@/constants/auth';
import { useSelfRegistration } from './useSelfRegistration';
import { useFamilyRegistration } from '@/containers/FamilyRegistration/composables/useFamilyRegistration';

vi.mock('@/containers/FamilyRegistration/composables/useFamilyRegistration', () => ({
  useFamilyRegistration: vi.fn(),
}));

function createRegistration(submitImplementation = vi.fn().mockResolvedValue()) {
  const isSubmitting = ref(false);
  const error = ref(null);
  const submit = vi.fn(async (payload) => {
    isSubmitting.value = true;
    error.value = null;
    try {
      return await submitImplementation(payload);
    } catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      throw error.value;
    } finally {
      isSubmitting.value = false;
    }
  });

  return { submit, isSubmitting, error };
}

describe('useSelfRegistration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the production family-registration workflow by default', async () => {
    const registration = createRegistration();
    vi.mocked(useFamilyRegistration).mockReturnValue(registration);
    const [workflow, app] = withSetup(() => useSelfRegistration());

    await expect(workflow.submit({ email: 'parent@example.com' })).resolves.toBe(true);

    expect(useFamilyRegistration).toHaveBeenCalledOnce();
    expect(registration.submit).toHaveBeenCalledWith({ email: 'parent@example.com' });
    expect(workflow.isSubmitting).toBe(registration.isSubmitting);
    expect(workflow.isSuccess.value).toBe(true);
    app.unmount();
  });

  it('prevents duplicate account-creation requests and exposes success after creation', async () => {
    let resolveCreation;
    const createAccount = vi.fn(() => new Promise((resolve) => (resolveCreation = resolve)));
    const registration = createRegistration(createAccount);
    const [workflow, app] = withSetup(() => useSelfRegistration({ registration }));

    const first = workflow.submit({ email: 'parent@example.com' });
    const second = await workflow.submit({ email: 'parent@example.com' });
    expect(second).toBe(false);
    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(workflow.isSuccess.value).toBe(false);

    resolveCreation();
    await first;
    expect(workflow.isSuccess.value).toBe(true);

    app.unmount();
  });

  it('maps unexpected provider failures to neutral recovery guidance', async () => {
    const registration = createRegistration(vi.fn().mockRejectedValue(new Error('internal provider detail')));
    const [workflow, app] = withSetup(() => useSelfRegistration({ registration }));

    await expect(workflow.submit({ email: 'parent@example.com' })).resolves.toBe(false);
    expect(workflow.errorMessage.value).toBe(ACCOUNT_CREATION_ERROR_MESSAGE);
    expect(workflow.errorMessage.value).not.toContain('provider detail');
    app.unmount();
  });

  it('does not reveal duplicate-account details', async () => {
    const duplicateError = new Error('This email address is already in use. Please sign in instead.');
    const registration = createRegistration(vi.fn().mockRejectedValue(duplicateError));
    const [workflow, app] = withSetup(() => useSelfRegistration({ registration }));

    await expect(workflow.submit({ email: 'parent@example.com' })).resolves.toBe(false);
    expect(workflow.errorMessage.value).toBe(ACCOUNT_CREATION_ERROR_MESSAGE);
    expect(workflow.errorMessage.value).not.toMatch(/already|exists|in use/i);
    app.unmount();
  });

  it('dismisses account-creation errors', async () => {
    const registration = createRegistration(vi.fn().mockRejectedValue(new Error('provider failure')));
    const [workflow, app] = withSetup(() => useSelfRegistration({ registration }));

    await workflow.submit({ email: 'parent@example.com' });
    workflow.dismissError();

    expect(registration.error.value).toBeNull();
    expect(workflow.errorMessage.value).toBe('');
    app.unmount();
  });
});
