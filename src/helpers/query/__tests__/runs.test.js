import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRunsRequestBody, runCounter, runPageFetcher } from '../runs';
import { convertValues, getAxiosInstance, mapFields } from '../utils';
import { pluralizeFirestoreCollection } from '@/helpers';

vi.mock('vue', () => ({
  toValue: vi.fn((val) => val),
}));

vi.mock('lodash/pick', () => ({
  default: vi.fn((obj, keys) => {
    const result = {};
    keys.forEach((key) => {
      if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    });
    return result;
  }),
}));

vi.mock('lodash/get', () => ({
  default: vi.fn((obj, path) => {
    const parts = path.split('.');
    let result = obj;
    for (const part of parts) {
      if (result === undefined || result === null) return undefined;
      result = result[part];
    }
    return result;
  }),
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

vi.mock('lodash/uniq', () => ({
  default: vi.fn((arr) => [...new Set(arr)]),
}));

vi.mock('lodash/without', () => ({
  default: vi.fn((arr, ...values) => arr.filter((item) => !values.includes(item))),
}));

const mockPost = vi.fn();

vi.mock('../utils', () => ({
  getAxiosInstance: vi.fn(() => ({
    post: mockPost,
    defaults: {
      baseURL: 'https://firestore.googleapis.com/v1/projects/test/databases/test/documents',
    },
  })),
  convertValues: vi.fn((val) => {
    if (val?.integerValue) return Number(val.integerValue);
    return val;
  }),
  mapFields: vi.fn((data) => {
    return data.map((item) => ({
      id: 'run1',
      parentDoc: 'user1',
      taskId: 'task1',
      scores: {
        computed: {
          composite: 85,
        },
      },
    }));
  }),
}));

vi.mock('@/helpers', () => ({
  pluralizeFirestoreCollection: vi.fn((type) => `${type}s`),
}));

describe('query/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRunsRequestBody', () => {
    it('should create a request body with correct structure for pagination', () => {
      const params = {
        administrationId: 'admin1',
        orgType: 'school',
        orgId: 'school1',
        pageLimit: 10,
        page: 0,
      };

      const result = getRunsRequestBody(params);

      expect(result.structuredQuery.limit).toBe(10);
      expect(result.structuredQuery.offset).toBe(0);
      expect(result.structuredQuery.from[0].collectionId).toBe('runs');
      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(3);
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.field.fieldPath).toBe('assignmentId');
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.stringValue).toBe('admin1');
      expect(result.structuredQuery.where.compositeFilter.filters[1].fieldFilter.field.fieldPath).toBe('bestRun');
      expect(result.structuredQuery.where.compositeFilter.filters[1].fieldFilter.value.booleanValue).toBe(true);
      expect(result.structuredQuery.where.compositeFilter.filters[2].fieldFilter.field.fieldPath).toBe(
        'readOrgs.schools',
      );
      expect(result.structuredQuery.where.compositeFilter.filters[2].fieldFilter.value.stringValue).toBe('school1');
    });

    it('should create a request body with taskId filter when provided', () => {
      const params = {
        administrationId: 'admin1',
        orgType: 'school',
        orgId: 'school1',
        taskId: 'task1',
      };

      const result = getRunsRequestBody(params);

      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(4);
      expect(result.structuredQuery.where.compositeFilter.filters[3].fieldFilter.field.fieldPath).toBe('taskId');
      expect(result.structuredQuery.where.compositeFilter.filters[3].fieldFilter.value.stringValue).toBe('task1');
    });

    it('should create a request body with completed filter when requireCompleted is true', () => {
      const params = {
        administrationId: 'admin1',
        orgType: 'school',
        orgId: 'school1',
        requireCompleted: true,
      };

      const result = getRunsRequestBody(params);

      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(4);
      expect(result.structuredQuery.where.compositeFilter.filters[3].fieldFilter.field.fieldPath).toBe('completed');
      expect(result.structuredQuery.where.compositeFilter.filters[3].fieldFilter.value.booleanValue).toBe(true);
    });

    it('should create an aggregation query when aggregationQuery is true', () => {
      const params = {
        administrationId: 'admin1',
        orgType: 'school',
        orgId: 'school1',
        aggregationQuery: true,
      };

      const result = getRunsRequestBody(params);

      expect(result.structuredAggregationQuery).toBeDefined();
      expect(result.structuredAggregationQuery.aggregations).toHaveLength(1);
      expect(result.structuredAggregationQuery.aggregations[0].alias).toBe('count');
    });

    it('should create a request body without orgId filter when not provided', () => {
      const params = {
        administrationId: 'admin1',
        allDescendants: false, // Need to set this to false to match the implementation
      };

      const result = getRunsRequestBody(params);

      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(2);
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.field.fieldPath).toBe('assignmentId');
      expect(result.structuredQuery.where.compositeFilter.filters[1].fieldFilter.field.fieldPath).toBe('bestRun');
    });

    it('should create a request body with only bestRun filter when no administrationId or orgId', () => {
      const params = {};

      const result = getRunsRequestBody(params);

      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(1);
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.field.fieldPath).toBe('bestRun');
    });
  });

  describe('runCounter', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      mockPost.mockResolvedValueOnce({
        data: [
          {
            result: {
              aggregateFields: {
                count: { integerValue: '42' },
              },
            },
          },
        ],
      });

      const result = await runCounter('admin1', 'school', 'school1');

      expect(getAxiosInstance).toHaveBeenCalledWith('app');
      expect(mockPost).toHaveBeenCalledWith(':runAggregationQuery', expect.any(Object));
      expect(convertValues).toHaveBeenCalledWith({ integerValue: '42' });
      expect(result).toBe(42);
    });
  });

  describe('runPageFetcher', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      mockPost.mockResolvedValueOnce({
        data: [
          {
            document: {
              name: 'projects/test/databases/test/documents/users/user1/runs/run1',
              fields: {
                taskId: { stringValue: 'task1' },
                scores: {
                  mapValue: {
                    fields: {
                      computed: {
                        mapValue: {
                          fields: {
                            composite: { integerValue: '85' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      });

      mockPost.mockResolvedValueOnce({
        data: [
          {
            found: {
              name: 'projects/test/databases/test/documents/users/user1',
              fields: {
                grade: { stringValue: '5' },
                birthMonth: { integerValue: '6' },
                birthYear: { integerValue: '2010' },
                schools: {
                  mapValue: {
                    fields: {
                      current: { arrayValue: { values: [{ stringValue: 'school1' }] } },
                    },
                  },
                },
              },
            },
          },
        ],
      });

      const params = {
        administrationId: 'admin1',
        orgType: 'school',
        orgId: 'school1',
        pageLimit: 10,
        page: 0,
      };

      const result = await runPageFetcher(params);

      expect(getAxiosInstance).toHaveBeenCalledWith('app');
      expect(mockPost).toHaveBeenCalledWith(':runQuery', expect.any(Object));
      expect(mockPost).toHaveBeenCalledWith(':batchGet', expect.any(Object));
      expect(mapFields).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('scores');
      expect(result[0]).toHaveProperty('taskId');
      expect(result[0]).toHaveProperty('user');
    });

    it('should use user-specific runQuery path when userId is provided', async () => {
      mockPost.mockResolvedValueOnce({
        data: [
          {
            document: {
              name: 'projects/test/databases/test/documents/users/user1/runs/run1',
              fields: {},
            },
          },
        ],
      });

      mockPost.mockResolvedValueOnce({
        data: [
          {
            found: {
              name: 'projects/test/databases/test/documents/users/user1',
              fields: {},
            },
          },
        ],
      });

      const params = {
        administrationId: 'admin1',
        userId: 'user1',
        orgType: 'school',
        orgId: 'school1',
      };

      await runPageFetcher(params);

      expect(mockPost).toHaveBeenCalledWith('/users/user1:runQuery', expect.any(Object));
    });
  });
});
