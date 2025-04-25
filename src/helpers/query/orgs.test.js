import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrgsRequestBody, orgFetcher, orgCounter } from '../orgs';
import { getAxiosInstance, mapFields, convertValues } from '../utils';

vi.mock('vue', () => ({
  toValue: vi.fn((val) => val),
}));

const mockPost = vi.fn().mockResolvedValue({ data: 'mockData' });

vi.mock('../utils', () => ({
  getAxiosInstance: vi.fn(() => ({
    post: mockPost,
  })),
  mapFields: vi.fn((data) => data),
  convertValues: vi.fn((val) => val),
  fetchDocById: vi.fn().mockResolvedValue({}),
  orderByDefault: [
    {
      field: { fieldPath: 'name' },
      direction: 'ASCENDING',
    },
  ],
}));

describe('query/orgs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrgsRequestBody', () => {
    it('should create a request body with correct structure', () => {
      const params = {
        orgType: 'schools',
        pageLimit: 10,
        page: 0,
      };

      const result = getOrgsRequestBody(params);

      expect(result.structuredQuery.limit).toBe(10);
      expect(result.structuredQuery.offset).toBe(0);
      expect(result.structuredQuery.from[0].collectionId).toBe('schools');
    });

    it('should add orderBy if provided', () => {
      const params = {
        orgType: 'schools',
        pageLimit: 10,
        page: 0,
        orderBy: { field: { fieldPath: 'name' }, direction: 'ASCENDING' },
      };

      const result = getOrgsRequestBody(params);

      expect(result.structuredQuery.orderBy).toEqual({ field: { fieldPath: 'name' }, direction: 'ASCENDING' });
    });

    it('should create an aggregation query when aggregationQuery is true', () => {
      const params = {
        orgType: 'schools',
        aggregationQuery: true,
      };

      const result = getOrgsRequestBody(params);

      expect(result.structuredAggregationQuery).toBeDefined();
      expect(result.structuredAggregationQuery.aggregations).toHaveLength(1);
      expect(result.structuredAggregationQuery.aggregations[0].alias).toBe('count');
    });

    it('should add filter for parent district when parentDistrict is provided', () => {
      const params = {
        orgType: 'schools',
        pageLimit: 10,
        page: 0,
        parentDistrict: 'district1',
      };

      const result = getOrgsRequestBody(params);

      expect(result.structuredQuery.where).toBeDefined();
      expect(result.structuredQuery.where.compositeFilter.filters[1].fieldFilter.field.fieldPath).toBe('districtId');
      expect(result.structuredQuery.where.compositeFilter.filters[1].fieldFilter.value.stringValue).toBe('district1');
    });
  });

  describe('orgFetcher', () => {
    it('should call getAxiosInstance and post with correct parameters for super admin', async () => {
      const axiosInstance = getAxiosInstance();

      await orgFetcher('schools', { value: 'district1' }, { value: true }, {});

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(axiosInstance.post).toHaveBeenCalledWith(':runQuery', expect.any(Object));
      expect(mapFields).toHaveBeenCalledWith('mockData');
    });
  });

  describe('orgCounter', () => {
    it('should call getAxiosInstance and post with correct parameters for super admin', async () => {
      const axiosInstance = getAxiosInstance();
      convertValues.mockReturnValue(5);

      const result = await orgCounter(
        { value: 'schools' },
        { value: 'district1' },
        { value: null },
        { value: { field: { fieldPath: 'name' }, direction: 'ASCENDING' } },
        { value: true },
        {},
      );

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(axiosInstance.post).toHaveBeenCalledWith(':runAggregationQuery', expect.any(Object));
      expect(convertValues).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });
});
