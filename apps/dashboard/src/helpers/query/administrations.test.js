import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTitle, administrationPageFetcher } from './administrations';
import { getAxiosInstance, convertValues } from './utils';

vi.mock('vue', () => ({
  toValue: vi.fn((val) => val),
}));

vi.mock('lodash/chunk', () => ({
  default: vi.fn((arr) => [arr]),
}));

vi.mock('lodash/last', () => ({
  default: vi.fn((arr) => arr[arr.length - 1]),
}));

vi.mock('lodash/mapValues', () => ({
  default: vi.fn((obj, fn) => {
    const result = {};
    Object.keys(obj).forEach((key) => {
      result[key] = fn(obj[key]);
    });
    return result;
  }),
}));

vi.mock('lodash/without', () => ({
  default: vi.fn((arr, val) => arr.filter((item) => item !== val)),
}));

const mockGetAssignmentStats = vi.fn().mockResolvedValue({
  data: {
    admin1: { total: { assignment: 30 } },
    admin2: { total: { assignment: 25 } },
  },
});

vi.mock('pinia', () => ({
  storeToRefs: vi.fn(() => ({
    roarfirekit: {
      value: {
        getAdministrations: vi.fn().mockResolvedValue(['admin1', 'admin2']),
        getAssignmentStats: mockGetAssignmentStats,
      },
    },
  })),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() => ({})),
}));

const mockPost = vi.fn();

vi.mock('./utils', () => ({
  getAxiosInstance: vi.fn(() => ({
    post: mockPost,
    defaults: {
      baseURL: 'https://firestore.googleapis.com/v1/projects/test/databases/test/documents',
    },
  })),
  convertValues: vi.fn((val) => {
    if (val?.stringValue) return val.stringValue;
    if (val?.integerValue) return Number(val.integerValue);
    if (val?.timestampValue) return val.timestampValue;
    if (val?.booleanValue !== undefined) return val.booleanValue;
    if (val?.arrayValue?.values) {
      return val.arrayValue.values.map((v) => convertValues(v));
    }
    if (val?.mapValue?.fields) {
      const result = {};
      Object.entries(val.mapValue.fields).forEach(([key, value]) => {
        result[key] = convertValues(value);
      });
      return result;
    }
    return val;
  }),
  orderByDefault: [
    {
      field: { fieldPath: 'name' },
      direction: 'ASCENDING',
    },
  ],
}));

vi.mock('@/helpers', () => ({
  filterAdminOrgs: vi.fn((orgs) => orgs),
}));

describe('query/administrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTitle', () => {
    it('should return name for super admin', () => {
      const item = { name: 'Admin Name', publicName: 'Public Name' };
      const result = getTitle(item, true);
      expect(result).toBe('Admin Name');
    });

    it('should return publicName for non-super admin if available', () => {
      const item = { name: 'Admin Name', publicName: 'Public Name' };
      const result = getTitle(item, false);
      expect(result).toBe('Public Name');
    });

    it('should fallback to name for non-super admin if publicName is not available', () => {
      const item = { name: 'Admin Name' };
      const result = getTitle(item, false);
      expect(result).toBe('Admin Name');
    });
  });

  describe('administrationPageFetcher', () => {
    it('should fetch and process administration data', async () => {
      mockPost.mockResolvedValueOnce({
        data: [
          {
            found: {
              name: 'projects/test/databases/test/documents/administrations/admin1',
              fields: {
                name: { stringValue: 'Admin 1' },
                publicName: { stringValue: 'Public Admin 1' },
                dateOpened: { timestampValue: '2023-01-01T00:00:00Z' },
                dateClosed: { timestampValue: '2023-12-31T00:00:00Z' },
                dateCreated: { timestampValue: '2022-12-01T00:00:00Z' },
                assessments: { arrayValue: { values: [{ stringValue: 'assessment1' }] } },
                testData: { booleanValue: false },
              },
            },
          },
          {
            found: {
              name: 'projects/test/databases/test/documents/administrations/admin2',
              fields: {
                name: { stringValue: 'Admin 2' },
                dateOpened: { timestampValue: '2023-02-01T00:00:00Z' },
                dateClosed: { timestampValue: '2023-11-30T00:00:00Z' },
                dateCreated: { timestampValue: '2023-01-15T00:00:00Z' },
                assessments: { arrayValue: { values: [{ stringValue: 'assessment2' }] } },
                testData: { booleanValue: true },
              },
            },
          },
        ],
      });

      const result = await administrationPageFetcher(
        false, // fetchTestData
        { value: [{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }] }, // orderBy
        true, // fetchStats (for super admin)
      );

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);

      expect(result[0].id).toBe('admin1');
      expect(result[0].name).toBe('Admin 1');
      expect(result[0].publicName).toBe('Public Admin 1');
      expect(result[0].dates.start).toBe('2023-01-01T00:00:00Z');
      expect(result[0].dates.end).toBe('2023-12-31T00:00:00Z');
      expect(result[0].dates.created).toBe('2022-12-01T00:00:00Z');
      expect(result[0].assessments).toEqual(['assessment1']);
      expect(result[0].stats.total).toBeDefined();
      expect(result[0].stats.total.assignment).toBe(30);
      expect(result[0].testData).toBe(false);

      expect(result[1].id).toBe('admin2');
      expect(result[1].name).toBe('Admin 2');
      expect(result[1].publicName).toBeUndefined();
      expect(result[1].testData).toBe(true);
      expect(result[1].stats.total.assignment).toBe(25);
    });

    it('should filter and sort administrations correctly', async () => {
      mockPost.mockResolvedValueOnce({
        data: [
          {
            found: {
              name: 'projects/test/databases/test/documents/administrations/admin2',
              fields: {
                name: { stringValue: 'Admin Z' }, // This should come second in ascending order
                publicName: { stringValue: 'Public Admin Z' },
                dateOpened: { timestampValue: '2023-01-15T00:00:00Z' },
                dateClosed: { timestampValue: '2023-12-15T00:00:00Z' },
                dateCreated: { timestampValue: '2023-01-15T00:00:00Z' },
                assessments: { arrayValue: { values: [] } },
                testData: { booleanValue: false },
              },
            },
          },
          {
            found: {
              name: 'projects/test/databases/test/documents/administrations/admin1',
              fields: {
                name: { stringValue: 'Admin A' }, // This should come first in ascending order
                publicName: { stringValue: 'Public Admin A' },
                dateOpened: { timestampValue: '2022-12-01T00:00:00Z' },
                dateClosed: { timestampValue: '2023-12-01T00:00:00Z' },
                dateCreated: { timestampValue: '2022-12-01T00:00:00Z' },
                assessments: { arrayValue: { values: [] } },
                testData: { booleanValue: false },
              },
            },
          },
        ],
      });

      const result = await administrationPageFetcher(
        false, // fetchTestData
        { value: [{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }] }, // orderBy
        true, // fetchStats
      );

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Admin A'); // Should be first in ascending order
      expect(result[1].name).toBe('Admin Z'); // Should be second in ascending order

      mockPost.mockResolvedValueOnce({
        data: [
          {
            found: {
              name: 'projects/test/databases/test/documents/administrations/admin2',
              fields: {
                name: { stringValue: 'Admin Z' },
                publicName: { stringValue: 'Public Admin Z' },
                dateOpened: { timestampValue: '2023-01-15T00:00:00Z' },
                dateClosed: { timestampValue: '2023-12-15T00:00:00Z' },
                dateCreated: { timestampValue: '2023-01-15T00:00:00Z' },
                assessments: { arrayValue: { values: [] } },
                testData: { booleanValue: false },
              },
            },
          },
          {
            found: {
              name: 'projects/test/databases/test/documents/administrations/admin1',
              fields: {
                name: { stringValue: 'Admin A' },
                publicName: { stringValue: 'Public Admin A' },
                dateOpened: { timestampValue: '2022-12-01T00:00:00Z' },
                dateClosed: { timestampValue: '2023-12-01T00:00:00Z' },
                dateCreated: { timestampValue: '2022-12-01T00:00:00Z' },
                assessments: { arrayValue: { values: [] } },
                testData: { booleanValue: false },
              },
            },
          },
        ],
      });

      const resultDesc = await administrationPageFetcher(
        false, // fetchTestData
        { value: [{ field: { fieldPath: 'name' }, direction: 'DESCENDING' }] }, // orderBy
        true, // fetchStats
      );

      expect(resultDesc).toHaveLength(2);
      expect(resultDesc[0].name).toBe('Admin Z'); // Should be first in descending order
      expect(resultDesc[1].name).toBe('Admin A'); // Should be second in descending order
    });

    it('should fetch administrations without stats when fetchStats is false', async () => {
      mockPost.mockResolvedValueOnce({
        data: [
          {
            found: {
              name: 'projects/test/databases/test/documents/administrations/admin1',
              fields: {
                name: { stringValue: 'Admin 1' },
                publicName: { stringValue: 'Public Admin 1' },
                dateOpened: { timestampValue: '2023-01-01T00:00:00Z' },
                dateClosed: { timestampValue: '2023-12-31T00:00:00Z' },
                dateCreated: { timestampValue: '2022-12-01T00:00:00Z' },
                assessments: { arrayValue: { values: [{ stringValue: 'assessment1' }] } },
                testData: { booleanValue: false },
              },
            },
          },
        ],
      });

      const result = await administrationPageFetcher(
        false, // fetchTestData
        { value: [{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }] }, // orderBy
        false, // fetchStats
      );

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockGetAssignmentStats).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);

      expect(result[0].id).toBe('admin1');
      expect(result[0].name).toBe('Admin 1');
      expect(result[0].stats).toEqual({});
    });
  });
});
