import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUsersRequestBody, fetchUsersByOrg, countUsersByOrg } from './users';
import { getAxiosInstance, mapFields, convertValues } from './utils';

vi.mock('vue', () => ({
  toValue: vi.fn((val) => val),
}));

const mockPost = vi.fn().mockResolvedValue({ data: 'mockData' });

vi.mock('./utils', () => ({
  getAxiosInstance: vi.fn(() => ({
    post: mockPost,
  })),
  mapFields: vi.fn((data) => data),
  convertValues: vi.fn((val) => val),
}));

vi.spyOn(console, 'log').mockImplementation(() => {});

describe('query/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsersRequestBody', () => {
    it('should create a request body with userIds', () => {
      const params = {
        userIds: ['user1', 'user2'],
        pageLimit: 10,
        page: 0,
      };

      const result = getUsersRequestBody(params);

      expect(result.structuredQuery.limit).toBe(10);
      expect(result.structuredQuery.offset).toBe(0);
      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(1);
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.field.fieldPath).toBe('id');
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.op).toBe('IN');
    });

    it('should create a request body with orgType and orgId', () => {
      const params = {
        orgType: 'schools',
        orgId: 'school1',
        pageLimit: 10,
        page: 0,
      };

      const result = getUsersRequestBody(params);

      expect(result.structuredQuery.limit).toBe(10);
      expect(result.structuredQuery.offset).toBe(0);
      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(1);
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.field.fieldPath).toBe(
        'schools.current',
      );
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.op).toBe('ARRAY_CONTAINS');
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.stringValue).toBe('school1');
    });

    it('should throw an error if neither userIds nor orgType and orgId are provided', () => {
      const params = {
        pageLimit: 10,
        page: 0,
      };

      expect(() => getUsersRequestBody(params)).toThrow('Must provide either userIds or orgType and orgId');
    });

    it('should add orderBy if provided', () => {
      const params = {
        userIds: ['user1'],
        pageLimit: 10,
        page: 0,
        orderBy: { field: { fieldPath: 'name' }, direction: 'ASCENDING' },
      };

      const result = getUsersRequestBody(params);

      expect(result.structuredQuery.orderBy).toEqual({ field: { fieldPath: 'name' }, direction: 'ASCENDING' });
    });

    it('should add filter for active users when restrictToActiveUsers is true', () => {
      const params = {
        userIds: ['user1'],
        pageLimit: 10,
        page: 0,
        restrictToActiveUsers: true,
      };

      const result = getUsersRequestBody(params);

      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(2);
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.field.fieldPath).toBe('archived');
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.booleanValue).toBe(false);
    });

    it('should create an aggregation query when aggregationQuery is true', () => {
      const params = {
        orgType: 'schools',
        orgId: 'school1',
        aggregationQuery: true,
      };

      const result = getUsersRequestBody(params);

      expect(result.structuredAggregationQuery).toBeDefined();
      expect(result.structuredAggregationQuery.aggregations).toHaveLength(1);
      expect(result.structuredAggregationQuery.aggregations[0].alias).toBe('count');
    });
  });

  describe('fetchUsersByOrg', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      mockPost.mockResolvedValueOnce({ data: 'mockData' });

      await fetchUsersByOrg('schools', 'school1', 10, 0, { field: { fieldPath: 'name' }, direction: 'ASCENDING' });

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(':runQuery', expect.any(Object));
      expect(mapFields).toHaveBeenCalledWith('mockData');
    });
  });

  describe('countUsersByOrg', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      mockPost.mockResolvedValueOnce({
        data: [
          {
            result: {
              aggregateFields: {
                count: { integerValue: '5' },
              },
            },
          },
        ],
      });

      convertValues.mockReturnValueOnce(5);

      const result = await countUsersByOrg('schools', 'school1', {
        field: { fieldPath: 'name' },
        direction: 'ASCENDING',
      });

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(':runAggregationQuery', expect.any(Object));
      expect(convertValues).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });
});
