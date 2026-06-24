import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useOrgExport } from './useOrgExport';
import * as queryUtils from '@/helpers/query/utils';
import * as Sentry from '@sentry/vue';
import { WARNING_LEVELS } from '../constants/exportConstants';

// Typed-client mocks: one `listUsers` action per org type, mirroring the
// per-org endpoints the export dispatches to.
const mockListDistrictUsers = vi.fn();
const mockListSchoolUsers = vi.fn();
const mockListClassUsers = vi.fn();
const mockListGroupUsers = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    districts: { listUsers: mockListDistrictUsers },
    schools: { listUsers: mockListSchoolUsers },
    classes: { listUsers: mockListClassUsers },
    groups: { listUsers: mockListGroupUsers },
  }),
}));

vi.mock('@/helpers/query/utils');
vi.mock('@sentry/vue');
vi.mock('@bdelab/roar-utils', () => ({
  default: {},
}));

// Builds a successful ts-rest page envelope: { status, body: { data: { items, pagination } } }.
const okPage = (items, { page, perPage, totalItems, totalPages }) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage, totalItems, totalPages } } },
});

// A representative enrolled-user API row with the demographics embed present.
const enrolledUser = (overrides = {}) => ({
  id: overrides.id ?? 'user-1',
  email: overrides.email ?? 'user1@test.com',
  username: overrides.username ?? 'user1',
  nameFirst: overrides.nameFirst ?? 'John',
  nameLast: overrides.nameLast ?? 'Doe',
  dob: overrides.dob ?? '2015-04-01',
  grade: overrides.grade ?? '3',
  gender: overrides.gender ?? 'male',
  roles: ['student'],
  demographics: {
    userType: 'student',
    statusEll: 'true',
    statusIep: 'false',
    statusFrl: 'Free',
    race: 'White, Asian',
    hispanicEthnicity: false,
    homeLanguage: 'Spanish',
    ...(overrides.demographics ?? {}),
  },
  ...(overrides.extra ?? {}),
});

describe('useOrgExport', () => {
  let activeOrgType;

  beforeEach(() => {
    activeOrgType = ref('districts');
    [mockListDistrictUsers, mockListSchoolUsers, mockListClassUsers, mockListGroupUsers].forEach((fn) =>
      fn.mockReset(),
    );
    vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});
    vi.spyOn(Sentry, 'captureException').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('getExportWarningLevel', () => {
    it('returns correct warning levels based on user count', () => {
      const { getExportWarningLevel } = useOrgExport(activeOrgType);

      expect(getExportWarningLevel(5000)).toBe(WARNING_LEVELS.NONE);
      expect(getExportWarningLevel(15000)).toBe(WARNING_LEVELS.NORMAL);
      expect(getExportWarningLevel(30000)).toBe(WARNING_LEVELS.STRONG);
      expect(getExportWarningLevel(60000)).toBe(WARNING_LEVELS.CRITICAL);
    });
  });

  describe('countOrgUsers', () => {
    it('reads pagination.totalItems from a one-row probe on the matching endpoint', async () => {
      const { countOrgUsers } = useOrgExport(activeOrgType);
      mockListDistrictUsers.mockResolvedValue(okPage([], { page: 1, perPage: 1, totalItems: 100, totalPages: 100 }));

      const count = await countOrgUsers({ id: 'org-1', name: 'Test Org' });

      expect(count).toBe(100);
      // A count probe must not pull user data: perPage is 1 and no embed is requested.
      expect(mockListDistrictUsers).toHaveBeenCalledTimes(1);
      expect(mockListDistrictUsers).toHaveBeenCalledWith({
        params: { districtId: 'org-1' },
        query: { page: 1, perPage: 1 },
      });
      expect(mockListSchoolUsers).not.toHaveBeenCalled();
    });

    it('dispatches the probe to the active org type endpoint with the right path param', async () => {
      activeOrgType.value = 'schools';
      const { countOrgUsers } = useOrgExport(activeOrgType);
      mockListSchoolUsers.mockResolvedValue(okPage([], { page: 1, perPage: 1, totalItems: 7, totalPages: 7 }));

      await countOrgUsers({ id: 'school-1', name: 'School' });

      expect(mockListSchoolUsers).toHaveBeenCalledWith({
        params: { schoolId: 'school-1' },
        query: { page: 1, perPage: 1 },
      });
      expect(mockListDistrictUsers).not.toHaveBeenCalled();
    });

    it('throws and reports to Sentry on a non-200 probe', async () => {
      const { countOrgUsers } = useOrgExport(activeOrgType);
      mockListDistrictUsers.mockResolvedValue({ status: 403, body: { error: { message: 'Forbidden' } } });

      await expect(countOrgUsers({ id: 'org-1', name: 'Org' })).rejects.toMatchObject({ status: 403 });
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('throws for an org type with no list endpoint (e.g. families)', async () => {
      activeOrgType.value = 'families';
      const { countOrgUsers } = useOrgExport(activeOrgType);

      await expect(countOrgUsers({ id: 'fam-1', name: 'Family' })).rejects.toThrow(/unsupported org type/);
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('performExport — single (paged assembly)', () => {
    it('pages through all pages, requests the demographics embed, and writes one CSV', async () => {
      const { performExport } = useOrgExport(activeOrgType);

      // Three pages of two rows each (perPage 100, but totalPages drives the loop).
      mockListDistrictUsers
        .mockResolvedValueOnce(
          okPage([enrolledUser({ id: 'u1', username: 'u1' }), enrolledUser({ id: 'u2', username: 'u2' })], {
            page: 1,
            perPage: 100,
            totalItems: 6,
            totalPages: 3,
          }),
        )
        .mockResolvedValueOnce(
          okPage([enrolledUser({ id: 'u3', username: 'u3' }), enrolledUser({ id: 'u4', username: 'u4' })], {
            page: 2,
            perPage: 100,
            totalItems: 6,
            totalPages: 3,
          }),
        )
        .mockResolvedValueOnce(
          okPage([enrolledUser({ id: 'u5', username: 'u5' }), enrolledUser({ id: 'u6', username: 'u6' })], {
            page: 3,
            perPage: 100,
            totalItems: 6,
            totalPages: 3,
          }),
        );

      const result = await performExport({ id: 'org-1', name: 'Test Org' }, 6);

      expect(result).toEqual({ success: true, batched: false, batchCount: 1 });

      // One request per page, capped at the endpoint max perPage, with the embed string.
      expect(mockListDistrictUsers).toHaveBeenCalledTimes(3);
      expect(mockListDistrictUsers).toHaveBeenNthCalledWith(1, {
        params: { districtId: 'org-1' },
        query: { page: 1, perPage: 100, embed: 'demographics' },
      });
      expect(mockListDistrictUsers).toHaveBeenNthCalledWith(3, {
        params: { districtId: 'org-1' },
        query: { page: 3, perPage: 100, embed: 'demographics' },
      });

      // Exactly one file, and all six rows from every page were accumulated.
      expect(queryUtils.exportCsv).toHaveBeenCalledTimes(1);
      const [exportedRows, filename] = queryUtils.exportCsv.mock.calls[0];
      expect(filename).toBe('test-org-users-export.csv');
      expect(exportedRows).toHaveLength(6);
      expect(exportedRows.map((r) => r.Username)).toEqual(['u1', 'u2', 'u3', 'u4', 'u5', 'u6']);
    });

    it('emits the exact pre-migration CSV column set, order, and cell formatting', async () => {
      const { performExport } = useOrgExport(activeOrgType);
      mockListDistrictUsers.mockResolvedValue(
        okPage([enrolledUser()], { page: 1, perPage: 100, totalItems: 1, totalPages: 1 }),
      );

      await performExport({ id: 'org-1', name: 'Test Org' }, 1);

      const [exportedRows] = queryUtils.exportCsv.mock.calls[0];
      expect(Object.keys(exportedRows[0])).toEqual([
        'Username',
        'Email',
        'FirstName',
        'LastName',
        'Grade',
        'Gender',
        'DateOfBirth',
        'UserType',
        'ell_status',
        'iep_status',
        'frl_status',
        'race',
        'hispanic_ethnicity',
        'home_language',
      ]);
      expect(exportedRows[0]).toEqual({
        Username: 'user1',
        Email: 'user1@test.com',
        FirstName: 'John',
        LastName: 'Doe',
        Grade: '3',
        Gender: 'male',
        DateOfBirth: '2015-04-01',
        UserType: 'student',
        ell_status: 'true',
        iep_status: 'false',
        frl_status: 'Free',
        // race stays a scalar comma-joined string; ethnicity stays a raw boolean.
        race: 'White, Asian',
        hispanic_ethnicity: false,
        home_language: 'Spanish',
      });
    });

    it('does not export retired tags/testData/demoData fields even if present on the API row', async () => {
      const { performExport } = useOrgExport(activeOrgType);
      mockListDistrictUsers.mockResolvedValue(
        okPage([enrolledUser({ extra: { tags: ['x'], testData: true, demoData: true } })], {
          page: 1,
          perPage: 100,
          totalItems: 1,
          totalPages: 1,
        }),
      );

      await performExport({ id: 'org-1', name: 'Test Org' }, 1);

      const [exportedRows] = queryUtils.exportCsv.mock.calls[0];
      expect(exportedRows[0]).not.toHaveProperty('tags');
      expect(exportedRows[0]).not.toHaveProperty('testData');
      expect(exportedRows[0]).not.toHaveProperty('demoData');
    });
  });

  describe('performExport — batched (large datasets)', () => {
    it('fetches all rows once then splits serialisation into multiple files', async () => {
      const { performExport } = useOrgExport(activeOrgType);

      // 60000 users => batched. Two pages reported (totalPages: 2) to prove the
      // loop still follows pagination; file-splitting is driven by row count.
      mockListDistrictUsers
        .mockResolvedValueOnce(okPage([enrolledUser()], { page: 1, perPage: 100, totalItems: 2, totalPages: 2 }))
        .mockResolvedValueOnce(okPage([enrolledUser()], { page: 2, perPage: 100, totalItems: 2, totalPages: 2 }));

      const result = await performExport({ id: 'org-1', name: 'Test Org' }, 60000);

      // Both pages fetched (bulk paged read, not N+1 per user).
      expect(mockListDistrictUsers).toHaveBeenCalledTimes(2);
      mockListDistrictUsers.mock.calls.forEach(([arg]) => {
        expect(arg.query.embed).toBe('demographics');
        expect(arg.query.perPage).toBe(100);
      });

      // Two accumulated rows fit in a single CSV_EXPORT_BATCH_SIZE batch → one file.
      expect(result).toEqual({ success: true, batched: true, batchCount: 1 });
      expect(queryUtils.exportCsv).toHaveBeenCalledTimes(1);
      expect(queryUtils.exportCsv.mock.calls[0][1]).toBe('test-org-users-export-part-1-of-1.csv');
    });
  });

  describe('cancellation', () => {
    it('stops the paged fetch and reports cancelled when cancel is requested up front', async () => {
      const { performExport, requestCancel } = useOrgExport(activeOrgType);
      mockListDistrictUsers.mockResolvedValue(
        okPage([enrolledUser()], { page: 1, perPage: 100, totalItems: 1, totalPages: 1 }),
      );

      requestCancel();
      const result = await performExport({ id: 'org-1', name: 'Test Org' }, 60000);

      expect(result.cancelled).toBe(true);
      // The fetch loop checks cancellation before its first request, so no fetch
      // and no file write occur.
      expect(mockListDistrictUsers).not.toHaveBeenCalled();
      expect(queryUtils.exportCsv).not.toHaveBeenCalled();
    });

    it('stops mid-fetch when cancel is requested between pages', async () => {
      const { performExport, requestCancel } = useOrgExport(activeOrgType);

      // First page resolves, then we cancel; the loop must not fetch page 2.
      mockListDistrictUsers.mockImplementationOnce(async () => {
        requestCancel();
        return okPage([enrolledUser()], { page: 1, perPage: 100, totalItems: 4, totalPages: 2 });
      });

      const result = await performExport({ id: 'org-1', name: 'Test Org' }, 5000);

      expect(result.cancelled).toBe(true);
      expect(mockListDistrictUsers).toHaveBeenCalledTimes(1);
      expect(queryUtils.exportCsv).not.toHaveBeenCalled();
    });
  });

  describe('hasNameProperty', () => {
    it('correctly identifies objects with a name property', () => {
      const { hasNameProperty } = useOrgExport(activeOrgType);

      expect(hasNameProperty({ name: 'Test' })).toBe(true);
      expect(hasNameProperty({ id: '123' })).toBe(false);
      expect(hasNameProperty(null)).toBeFalsy();
      expect(hasNameProperty(undefined)).toBeFalsy();
    });
  });
});
