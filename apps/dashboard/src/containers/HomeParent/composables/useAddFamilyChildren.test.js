import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';

// --- Mocks -----------------------------------------------------------------

const mockAddChildren = vi.fn();
vi.mock('@/composables/mutations/useAddFamilyChildrenMutation', () => ({
  default: () => ({ mutateAsync: (...args) => mockAddChildren(...args) }),
}));

const mockRecordAgreement = vi.fn();
vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { recordUserAgreement: (...args) => mockRecordAgreement(...args) },
  }),
}));

const mockResolveConsent = vi.fn();
vi.mock('@/helpers/registration/resolveConsentAgreementVersionId', () => ({
  resolveConsentAgreementVersionId: (...args) => mockResolveConsent(...args),
}));

const mockMapStudent = vi.fn();
vi.mock('@/helpers/registration/mapStudentFormToAddChild', () => ({
  mapStudentFormToAddChild: (...args) => mockMapStudent(...args),
}));

import { useAddFamilyChildren } from './useAddFamilyChildren';

const STUDENTS = [{ studentUsername: 'a' }, { studentUsername: 'b' }];

function setupSaga() {
  const [result] = withSetup(() => useAddFamilyChildren());
  return result;
}

describe('useAddFamilyChildren', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveConsent.mockResolvedValue('ver-1');
    mockMapStudent.mockImplementation((s) => ({ email: `${s.studentUsername}@roar-auth.com` }));
    mockAddChildren.mockResolvedValue({ ids: ['c1', 'c2'] });
    mockRecordAgreement.mockResolvedValue({ status: 201, body: { data: { id: 'rec' } } });
  });

  it('resolves consent, adds children, then records consent for each child id', async () => {
    const order = [];
    mockResolveConsent.mockImplementation(async () => {
      order.push('resolveConsent');
      return 'ver-1';
    });
    mockAddChildren.mockImplementation(async () => {
      order.push('addChildren');
      return { ids: ['c1', 'c2'] };
    });
    mockRecordAgreement.mockImplementation(async ({ params }) => {
      order.push(`record:${params.userId}`);
      return { status: 201, body: { data: { id: 'rec' } } };
    });

    const saga = setupSaga();
    const out = await saga.submit({ familyId: 'fam-1', students: STUDENTS });

    expect(out).toEqual({ ids: ['c1', 'c2'] });
    expect(order).toEqual(['resolveConsent', 'addChildren', 'record:c1', 'record:c2']);
    expect(mockAddChildren).toHaveBeenCalledWith({
      familyId: 'fam-1',
      body: { children: [{ email: 'a@roar-auth.com' }, { email: 'b@roar-auth.com' }] },
    });
    expect(mockRecordAgreement).toHaveBeenCalledTimes(2);
    expect(mockRecordAgreement).toHaveBeenNthCalledWith(1, {
      params: { userId: 'c1' },
      body: { agreementVersionId: 'ver-1' },
    });
    expect(mockRecordAgreement).toHaveBeenNthCalledWith(2, {
      params: { userId: 'c2' },
      body: { agreementVersionId: 'ver-1' },
    });
  });

  it('aborts BEFORE adding children when consent cannot be resolved', async () => {
    mockResolveConsent.mockRejectedValueOnce(new Error('No current consent agreement is available'));

    const saga = setupSaga();
    await expect(saga.submit({ familyId: 'fam-1', students: STUDENTS })).rejects.toThrow(/consent/i);
    expect(mockAddChildren).not.toHaveBeenCalled();
    expect(mockRecordAgreement).not.toHaveBeenCalled();
  });

  it('aborts BEFORE adding children when a student fails to map', async () => {
    mockMapStudent.mockImplementation(() => {
      throw new Error('Student first and last name are required.');
    });

    const saga = setupSaga();
    await expect(saga.submit({ familyId: 'fam-1', students: STUDENTS })).rejects.toThrow(/name/i);
    expect(mockAddChildren).not.toHaveBeenCalled();
  });

  it('requires a familyId', async () => {
    const saga = setupSaga();
    await expect(saga.submit({ familyId: '', students: STUDENTS })).rejects.toThrow(/family id/i);
    expect(mockAddChildren).not.toHaveBeenCalled();
  });

  it('requires at least one student', async () => {
    const saga = setupSaga();
    await expect(saga.submit({ familyId: 'fam-1', students: [] })).rejects.toThrow(/at least one student/i);
  });

  it('treats a 409 on a child consent record as success', async () => {
    mockRecordAgreement
      .mockResolvedValueOnce({ status: 201, body: { data: { id: 'rec' } } })
      .mockResolvedValueOnce({ status: 409, body: { error: { code: 'already-recorded' } } });

    const saga = setupSaga();
    await expect(saga.submit({ familyId: 'fam-1', students: STUDENTS })).resolves.toEqual({ ids: ['c1', 'c2'] });
  });

  it('throws (identifying the child) when a child consent record fails', async () => {
    mockRecordAgreement
      .mockResolvedValueOnce({ status: 201, body: { data: { id: 'rec' } } })
      .mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

    const saga = setupSaga();
    await expect(saga.submit({ familyId: 'fam-1', students: STUDENTS })).rejects.toMatchObject({
      status: 500,
      childId: 'c2',
    });
  });
});
