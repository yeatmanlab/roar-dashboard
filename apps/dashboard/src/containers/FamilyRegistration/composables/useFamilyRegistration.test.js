import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';

// --- Mocks -----------------------------------------------------------------

const mockLogIn = vi.fn();
const mockForceRefresh = vi.fn();
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    logInWithEmailAndPassword: (...args) => mockLogIn(...args),
    forceIdTokenRefresh: (...args) => mockForceRefresh(...args),
  }),
}));

const mockCreateFamily = vi.fn();
vi.mock('@/composables/mutations/useCreateFamilyMutation', () => ({
  default: () => ({ mutateAsync: (...args) => mockCreateFamily(...args) }),
}));

const mockMeGet = vi.fn();
const mockRecordAgreement = vi.fn();
vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    me: { get: (...args) => mockMeGet(...args) },
    users: { recordUserAgreement: (...args) => mockRecordAgreement(...args) },
  }),
}));

const mockResolveConsent = vi.fn();
vi.mock('@/helpers/registration/resolveConsentAgreementVersionId', () => ({
  resolveConsentAgreementVersionId: (...args) => mockResolveConsent(...args),
}));

import { useFamilyRegistration } from './useFamilyRegistration';

const FORM = { email: 'parent@example.com', password: 'super-secret', firstName: 'Pat', lastName: 'Guardian' };

function setupSaga() {
  const [result] = withSetup(() => useFamilyRegistration());
  return result;
}

describe('useFamilyRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveConsent.mockResolvedValue('ver-1');
    mockCreateFamily.mockResolvedValue({ id: 'fam-1' });
    mockLogIn.mockResolvedValue(undefined);
    mockForceRefresh.mockResolvedValue('fresh-token');
    mockMeGet.mockResolvedValue({ status: 200, body: { data: { id: 'parent-1' } } });
    mockRecordAgreement.mockResolvedValue({ status: 201, body: { data: { id: 'rec-1' } } });
  });

  it('runs the happy path in order: resolve consent → create → sign in → /me → record consent', async () => {
    const order = [];
    mockResolveConsent.mockImplementation(async () => {
      order.push('resolveConsent');
      return 'ver-1';
    });
    mockCreateFamily.mockImplementation(async () => {
      order.push('createFamily');
      return { id: 'fam-1' };
    });
    mockLogIn.mockImplementation(async () => {
      order.push('signIn');
    });
    mockMeGet.mockImplementation(async () => {
      order.push('me');
      return { status: 200, body: { data: { id: 'parent-1' } } };
    });
    mockRecordAgreement.mockImplementation(async () => {
      order.push('recordConsent');
      return { status: 201, body: { data: { id: 'rec-1' } } };
    });

    const saga = setupSaga();
    await saga.submit(FORM);

    expect(order).toEqual(['resolveConsent', 'createFamily', 'signIn', 'me', 'recordConsent']);
    // Create body excludes legacy fields / isTestData.
    expect(mockCreateFamily).toHaveBeenCalledWith({
      body: { email: 'parent@example.com', password: 'super-secret', name: { first: 'Pat', last: 'Guardian' } },
    });
    // Consent recorded for the parent's /me id with the resolved version.
    expect(mockRecordAgreement).toHaveBeenCalledWith({
      params: { userId: 'parent-1' },
      body: { agreementVersionId: 'ver-1' },
    });
    expect(saga.error.value).toBeNull();
  });

  it('aborts BEFORE creating the family when consent cannot be resolved', async () => {
    mockResolveConsent.mockRejectedValueOnce(new Error('No current consent agreement is available'));

    const saga = setupSaga();
    await expect(saga.submit(FORM)).rejects.toThrow(/consent/i);

    expect(mockCreateFamily).not.toHaveBeenCalled();
    expect(mockLogIn).not.toHaveBeenCalled();
    expect(mockRecordAgreement).not.toHaveBeenCalled();
  });

  it('surfaces a terminal "email in use" error on a 409 create and does not sign in', async () => {
    const err = new Error('conflict');
    err.status = 409;
    mockCreateFamily.mockRejectedValueOnce(err);

    const saga = setupSaga();
    await expect(saga.submit(FORM)).rejects.toThrow(/already in use/i);

    expect(mockLogIn).not.toHaveBeenCalled();
    expect(mockRecordAgreement).not.toHaveBeenCalled();
  });

  it('on a 422 (family already exists) resumes by signing in and recording parent consent', async () => {
    const err = new Error('unprocessable');
    err.status = 422;
    mockCreateFamily.mockRejectedValueOnce(err);

    const saga = setupSaga();
    await saga.submit(FORM);

    expect(mockLogIn).toHaveBeenCalledWith({ email: 'parent@example.com', password: 'super-secret' });
    expect(mockRecordAgreement).toHaveBeenCalledWith({
      params: { userId: 'parent-1' },
      body: { agreementVersionId: 'ver-1' },
    });
  });

  it('on a 422 then a failed sign-in surfaces a recoverable "please sign in" error', async () => {
    const err = new Error('unprocessable');
    err.status = 422;
    mockCreateFamily.mockRejectedValueOnce(err);
    mockLogIn.mockRejectedValueOnce(new Error('wrong password'));

    const saga = setupSaga();
    await expect(saga.submit(FORM)).rejects.toThrow(/sign in to finish/i);
  });

  it('treats a 409 on the consent record as success (idempotent re-entry)', async () => {
    mockRecordAgreement.mockResolvedValueOnce({ status: 409, body: { error: { code: 'already-recorded' } } });

    const saga = setupSaga();
    await expect(saga.submit(FORM)).resolves.toBeUndefined();
    expect(saga.error.value).toBeNull();
  });

  it('throws and sets error when consent recording fails after sign-in', async () => {
    mockRecordAgreement.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

    const saga = setupSaga();
    await expect(saga.submit(FORM)).rejects.toThrow(/record consent/i);
    expect(saga.error.value).toBeInstanceOf(Error);
  });
});
