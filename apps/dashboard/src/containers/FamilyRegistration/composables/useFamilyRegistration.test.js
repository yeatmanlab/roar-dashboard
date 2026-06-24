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

// The migrated registration saga does NO agreement work. These API methods are
// mocked as spies purely so the tests can assert they are NEVER called — the
// pre-auth `GET /v1/agreements` lookup and the consent `recordUserAgreement`
// call have both been removed (TOS is handled post-login by the
// `/me.unsignedAgreements` gate; consent is per-administration and handled by
// the post-auth consent gate).
const mockMeGet = vi.fn();
const mockRecordAgreement = vi.fn();
const mockAgreementsList = vi.fn();
vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    me: { get: (...args) => mockMeGet(...args) },
    users: { recordUserAgreement: (...args) => mockRecordAgreement(...args) },
    agreements: { list: (...args) => mockAgreementsList(...args) },
  }),
}));

import { useFamilyRegistration } from './useFamilyRegistration';

const FORM = { email: 'parent@example.com', password: 'super-secret', firstName: 'Pat', lastName: 'Guardian' };

function setupSaga() {
  const [result] = withSetup(() => useFamilyRegistration());
  return result;
}

/** Asserts the saga touched no agreement-related API surface. */
function expectNoAgreementWork() {
  expect(mockAgreementsList).not.toHaveBeenCalled();
  expect(mockMeGet).not.toHaveBeenCalled();
  expect(mockRecordAgreement).not.toHaveBeenCalled();
}

describe('useFamilyRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFamily.mockResolvedValue({ id: 'fam-1' });
    mockLogIn.mockResolvedValue(undefined);
    mockForceRefresh.mockResolvedValue('fresh-token');
  });

  it('runs the happy path in order: create family → sign in (no agreement work)', async () => {
    const order = [];
    mockCreateFamily.mockImplementation(async () => {
      order.push('createFamily');
      return { id: 'fam-1' };
    });
    mockLogIn.mockImplementation(async () => {
      order.push('signIn');
    });
    mockForceRefresh.mockImplementation(async () => {
      order.push('refresh');
      return 'fresh-token';
    });

    const saga = setupSaga();
    await saga.submit(FORM);

    expect(order).toEqual(['createFamily', 'signIn', 'refresh']);
    // Create body excludes legacy fields / isTestData.
    expect(mockCreateFamily).toHaveBeenCalledWith({
      body: { email: 'parent@example.com', password: 'super-secret', name: { first: 'Pat', last: 'Guardian' } },
    });
    expect(mockLogIn).toHaveBeenCalledWith({ email: 'parent@example.com', password: 'super-secret' });
    expectNoAgreementWork();
    expect(saga.error.value).toBeNull();
  });

  it('surfaces a terminal "email in use" error on a 409 create and does not sign in', async () => {
    const err = new Error('conflict');
    err.status = 409;
    mockCreateFamily.mockRejectedValueOnce(err);

    const saga = setupSaga();
    await expect(saga.submit(FORM)).rejects.toThrow(/already in use/i);

    expect(mockLogIn).not.toHaveBeenCalled();
    expectNoAgreementWork();
  });

  it('on a 422 (family already exists) resumes by simply signing in', async () => {
    const err = new Error('unprocessable');
    err.status = 422;
    mockCreateFamily.mockRejectedValueOnce(err);

    const saga = setupSaga();
    await saga.submit(FORM);

    expect(mockLogIn).toHaveBeenCalledWith({ email: 'parent@example.com', password: 'super-secret' });
    expectNoAgreementWork();
    expect(saga.error.value).toBeNull();
  });

  it('on a 422 then a failed sign-in surfaces a recoverable "please sign in" error', async () => {
    const err = new Error('unprocessable');
    err.status = 422;
    mockCreateFamily.mockRejectedValueOnce(err);
    mockLogIn.mockRejectedValueOnce(new Error('wrong password'));

    const saga = setupSaga();
    await expect(saga.submit(FORM)).rejects.toThrow(/sign in to finish/i);
    expectNoAgreementWork();
  });

  it('re-throws an unexpected create error and sets error state', async () => {
    const err = new Error('boom');
    err.status = 500;
    mockCreateFamily.mockRejectedValueOnce(err);

    const saga = setupSaga();
    await expect(saga.submit(FORM)).rejects.toThrow(/boom/i);

    expect(mockLogIn).not.toHaveBeenCalled();
    expect(saga.error.value).toBeInstanceOf(Error);
    expectNoAgreementWork();
  });
});
