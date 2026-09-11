import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';

// --- Mocks -----------------------------------------------------------------

const mockAddChildren = vi.fn();
vi.mock('@/composables/mutations/useAddFamilyChildrenMutation', () => ({
  default: () => ({ mutateAsync: (...args) => mockAddChildren(...args) }),
}));

// Adding children does NO agreement work anymore. This client method is mocked
// as a spy purely so the tests can assert it is NEVER called — the per-child
// consent `recordUserAgreement` loop has been removed (each child's consent is
// per-administration and handled by the post-auth consent gate).
const mockRecordAgreement = vi.fn();
vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { recordUserAgreement: (...args) => mockRecordAgreement(...args) },
  }),
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
    mockMapStudent.mockImplementation((s) => ({ email: `${s.studentUsername}@roar-auth.com` }));
    mockAddChildren.mockResolvedValue({ ids: ['c1', 'c2'] });
  });

  it('maps the students and adds them, doing no agreement work', async () => {
    const saga = setupSaga();
    const out = await saga.submit({ familyId: 'fam-1', students: STUDENTS });

    expect(out).toEqual({ ids: ['c1', 'c2'] });
    expect(mockAddChildren).toHaveBeenCalledWith({
      familyId: 'fam-1',
      body: { children: [{ email: 'a@roar-auth.com' }, { email: 'b@roar-auth.com' }] },
    });
    expect(mockRecordAgreement).not.toHaveBeenCalled();
    expect(saga.error.value).toBeNull();
  });

  it('aborts BEFORE adding children when a student fails to map', async () => {
    mockMapStudent.mockImplementation(() => {
      throw new Error('Student first and last name are required.');
    });

    const saga = setupSaga();
    await expect(saga.submit({ familyId: 'fam-1', students: STUDENTS })).rejects.toThrow(/name/i);
    expect(mockAddChildren).not.toHaveBeenCalled();
    expect(mockRecordAgreement).not.toHaveBeenCalled();
  });

  it('requires a familyId', async () => {
    const saga = setupSaga();
    await expect(saga.submit({ familyId: '', students: STUDENTS })).rejects.toThrow(/family id/i);
    expect(mockAddChildren).not.toHaveBeenCalled();
  });

  it('requires at least one student', async () => {
    const saga = setupSaga();
    await expect(saga.submit({ familyId: 'fam-1', students: [] })).rejects.toThrow(/at least one student/i);
    expect(mockAddChildren).not.toHaveBeenCalled();
  });

  it('surfaces an add-children failure and sets error state', async () => {
    const err = new Error('add failed');
    err.status = 422;
    mockAddChildren.mockRejectedValueOnce(err);

    const saga = setupSaga();
    await expect(saga.submit({ familyId: 'fam-1', students: STUDENTS })).rejects.toMatchObject({ status: 422 });
    expect(saga.error.value).toBeInstanceOf(Error);
    expect(mockRecordAgreement).not.toHaveBeenCalled();
  });
});
