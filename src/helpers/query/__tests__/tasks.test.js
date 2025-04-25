import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTasksRequestBody, taskFetcher, fetchByTaskId, getVariantsRequestBody, variantsFetcher } from '../tasks';
import { getAxiosInstance, mapFields, convertValues } from '../utils';

vi.mock('vue', () => ({
  toValue: vi.fn((val) => val),
}));

const mockPost = vi.fn().mockResolvedValue({ data: 'mockData' });

vi.mock('../utils', () => ({
  getAxiosInstance: vi.fn((db) => ({
    post: mockPost,
    get: vi.fn().mockResolvedValue({ data: { fields: {} } }),
  })),
  mapFields: vi.fn((data) => data),
  convertValues: vi.fn((val) => val),
  fetchDocsById: vi.fn().mockResolvedValue([]),
}));

describe('query/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTasksRequestBody', () => {
    it('should create a request body with correct structure', () => {
      const params = {
        pageLimit: 10,
        page: 0,
        paginate: true,
      };

      const result = getTasksRequestBody(params);

      expect(result.structuredQuery.limit).toBe(10);
      expect(result.structuredQuery.offset).toBe(0);
      expect(result.structuredQuery.from[0].collectionId).toBe('tasks');
    });

    it('should add orderBy if provided', () => {
      const params = {
        pageLimit: 10,
        page: 0,
        paginate: true,
        orderBy: { field: { fieldPath: 'name' }, direction: 'ASCENDING' },
      };

      const result = getTasksRequestBody(params);

      expect(result.structuredQuery.orderBy).toEqual({ field: { fieldPath: 'name' }, direction: 'ASCENDING' });
    });

    it('should create an aggregation query when aggregationQuery is true', () => {
      const params = {
        aggregationQuery: true,
      };

      const result = getTasksRequestBody(params);

      expect(result.structuredAggregationQuery).toBeDefined();
      expect(result.structuredAggregationQuery.aggregations).toHaveLength(1);
      expect(result.structuredAggregationQuery.aggregations[0].alias).toBe('count');
    });
  });

  describe('taskFetcher', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      mockPost.mockResolvedValueOnce({ data: 'mockData' });

      await taskFetcher(true, false, ['name']);

      expect(getAxiosInstance).toHaveBeenCalledWith('app');
      expect(mockPost).toHaveBeenCalledWith(':runQuery', expect.any(Object));
      expect(mapFields).toHaveBeenCalledWith('mockData');
    });
  });

  describe('fetchByTaskId', () => {
    it('should call fetchDocsById with correct parameters', async () => {
      const taskIds = ['task1', 'task2'];

      await fetchByTaskId(taskIds);

      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('getVariantsRequestBody', () => {
    it('should create a request body with correct structure', async () => {
      const params = {
        pageLimit: 10,
        page: 0,
        paginate: true,
      };

      const result = getVariantsRequestBody(params);

      expect(result.structuredQuery.limit).toBe(10);
      expect(result.structuredQuery.offset).toBe(0);
      expect(result.structuredQuery.from[0].collectionId).toBe('variants');
    });

    it('should create an aggregation query when aggregationQuery is true', () => {
      const params = {
        aggregationQuery: true,
      };

      const result = getVariantsRequestBody(params);

      expect(result.structuredAggregationQuery).toBeDefined();
      expect(result.structuredAggregationQuery.aggregations).toHaveLength(1);
      expect(result.structuredAggregationQuery.aggregations[0].alias).toBe('count');
    });
  });

  describe('variantsFetcher', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      const variantData = [
        {
          document: {
            name: 'projects/test/databases/test/documents/tasks/task1/variants/variant1',
          },
        },
      ];

      mapFields.mockImplementationOnce(() => {
        return [
          {
            id: 'variant1',
            parentDoc: 'task1',
            name: 'Variant 1',
          },
        ];
      });

      const firstMockPost = vi.fn().mockResolvedValue({ data: variantData });

      const secondMockPost = vi.fn().mockResolvedValue({
        data: [
          {
            found: {
              name: 'projects/test/databases/test/documents/tasks/task1',
              fields: {
                id: { stringValue: 'task1' },
                name: { stringValue: 'Task 1' },
              },
            },
          },
        ],
      });

      mockPost.mockImplementationOnce(firstMockPost).mockImplementationOnce(secondMockPost);

      convertValues.mockImplementation((value) => {
        if (value?.stringValue) return value.stringValue;
        return value;
      });

      const result = await variantsFetcher(false);

      expect(getAxiosInstance).toHaveBeenCalledWith('app');
      expect(mockPost).toHaveBeenCalledWith(':runQuery', expect.any(Object));
      expect(mockPost).toHaveBeenCalledWith(':batchGet', expect.any(Object));
      expect(mapFields).toHaveBeenCalledWith(variantData, true);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'variant1');
      expect(result[0]).toHaveProperty('variant');
      expect(result[0]).toHaveProperty('task');
    });
  });
});
