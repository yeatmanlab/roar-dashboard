import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAssignmentsRequestBody,
  assignmentCounter,
  assignmentPageFetcher,
  getUserAssignments,
  assignmentFetchAll,
  adminOrgIntersection,
  highestAdminOrgIntersection,
} from './assignments';
import { getAxiosInstance, mapFields, convertValues } from './utils';

vi.mock('vue', () => ({
  toValue: vi.fn((val) => val),
  toRaw: vi.fn((val) => val),
}));

const mockPost = vi.fn().mockResolvedValue({ data: 'mockData' });

vi.mock('./utils', () => ({
  getAxiosInstance: vi.fn(() => ({
    post: mockPost,
    defaults: {
      baseURL: 'https://firestore.googleapis.com/v1/projects/test/databases/test/documents',
    },
  })),
  mapFields: vi.fn((data) => data),
  convertValues: vi.fn((val) => val),
}));

vi.mock('@/helpers', () => ({
  pluralizeFirestoreCollection: vi.fn((type) => `${type}s`),
  flattenObj: vi.fn((obj) => obj),
}));

vi.mock('@/constants/orgTypes', () => ({
  ORG_TYPES: {
    DISTRICT: 'districts',
    SCHOOL: 'schools',
    CLASS: 'classes',
  },
  ORG_TYPES_IN_ORDER: ['districts', 'schools', 'classes'],
}));

describe('query/assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAssignmentsRequestBody', () => {
    it('should create a request body with orgType and orgId', () => {
      const params = {
        orgType: 'school',
        orgId: 'school1',
        pageLimit: 10,
        page: 0,
      };

      const result = getAssignmentsRequestBody(params);

      expect(result.structuredQuery.limit).toBe(10);
      expect(result.structuredQuery.offset).toBe(0);
      expect(result.structuredQuery.from[0].collectionId).toBe('assignments');
      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(1);
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.field.fieldPath).toBe(
        'readOrgs.schools',
      );
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.stringValue).toBe('school1');
    });

    it('should create a request body with adminId', () => {
      const params = {
        adminId: 'admin1',
        pageLimit: 10,
        page: 0,
      };

      const result = getAssignmentsRequestBody(params);

      expect(result.structuredQuery.where.compositeFilter.filters).toHaveLength(1);
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.field.fieldPath).toBe('id');
      expect(result.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.stringValue).toBe('admin1');
    });

    it('should add orderBy if provided', () => {
      const params = {
        adminId: 'admin1',
        pageLimit: 10,
        page: 0,
        orderBy: [{ field: { fieldPath: 'dateAssigned' }, direction: 'DESCENDING' }],
      };

      const result = getAssignmentsRequestBody(params);

      expect(result.structuredQuery.orderBy).toEqual([
        { field: { fieldPath: 'dateAssigned' }, direction: 'DESCENDING' },
      ]);
    });

    it('should create an aggregation query when aggregationQuery is true', () => {
      const params = {
        adminId: 'admin1',
        aggregationQuery: true,
      };

      const result = getAssignmentsRequestBody(params);

      expect(result.structuredAggregationQuery).toBeDefined();
      expect(result.structuredAggregationQuery.aggregations).toHaveLength(1);
      expect(result.structuredAggregationQuery.aggregations[0].alias).toBe('count');
    });
  });

  describe('assignmentCounter', () => {
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

      const result = await assignmentCounter('admin1', 'school', 'school1', [
        { field: { fieldPath: 'dateAssigned' }, direction: 'DESCENDING' },
      ]);

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(':runAggregationQuery', expect.any(Object));
      expect(convertValues).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });

  describe('assignmentPageFetcher', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      mockPost.mockImplementation((url) => {
        if (url === ':runQuery') {
          return Promise.resolve({
            data: [
              {
                document: {
                  name: 'projects/test/databases/test/documents/users/user1/assignments/assignment1',
                  fields: { name: { stringValue: 'Assignment 1' } },
                },
              },
            ],
          });
        } else if (url === ':batchGet') {
          return Promise.resolve({
            data: [
              {
                found: {
                  name: 'projects/test/databases/test/documents/users/user1',
                  fields: { name: { stringValue: 'User 1' } },
                },
              },
            ],
          });
        }
        return Promise.resolve({ data: {} });
      });

      mapFields.mockReturnValueOnce([
        {
          id: 'assignment1',
          name: 'Assignment 1',
          parentDoc: 'user1',
          assessments: [],
        },
      ]);

      const result = await assignmentPageFetcher('admin1', 'school', 'school1', { value: 10 }, { value: 0 }, false);

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(':runQuery', expect.any(Object));
      expect(mockPost).toHaveBeenCalledWith(':batchGet', expect.any(Object));
      expect(mapFields).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('assignment');
      expect(result[0]).toHaveProperty('user');
      expect(result[0]).toHaveProperty('roarUid');
    });
  });

  describe('getUserAssignments', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      mockPost.mockResolvedValueOnce({
        data: [
          {
            document: {
              name: 'projects/test/databases/test/documents/users/user1/assignments/assignment1',
              fields: {
                name: { stringValue: 'Assignment 1' },
                dateOpened: { timestampValue: new Date().toISOString() },
              },
            },
          },
        ],
      });

      mapFields.mockReturnValueOnce([
        {
          id: 'assignment1',
          name: 'Assignment 1',
          dateOpened: new Date().toISOString(),
        },
      ]);

      const result = await getUserAssignments('user1');

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith('/users/user1:runQuery', expect.any(Object));
      expect(mapFields).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('assignmentFetchAll', () => {
    it('should call assignmentPageFetcher with correct parameters', async () => {
      mockPost.mockImplementation((url) => {
        if (url === ':runQuery') {
          return Promise.resolve({
            data: [
              {
                document: {
                  name: 'projects/test/databases/test/documents/users/user1/assignments/assignment1',
                  fields: { name: { stringValue: 'Assignment 1' } },
                },
              },
            ],
          });
        } else if (url === ':batchGet') {
          return Promise.resolve({
            data: [
              {
                found: {
                  name: 'projects/test/databases/test/documents/users/user1',
                  fields: { name: { stringValue: 'User 1' } },
                },
              },
            ],
          });
        }
        return Promise.resolve({ data: {} });
      });

      mapFields.mockReturnValueOnce([
        {
          id: 'assignment1',
          name: 'Assignment 1',
          parentDoc: 'user1',
          assessments: [],
        },
      ]);

      const result = await assignmentFetchAll('admin1', 'school', 'school1', false);

      expect(getAxiosInstance).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(':runQuery', expect.any(Object));
      expect(mockPost).toHaveBeenCalledWith(':batchGet', expect.any(Object));
      expect(result).toBeDefined();
    });
  });

  describe('adminOrgIntersection', () => {
    it('should return intersection of participant and admin orgs', () => {
      const participantData = {
        districts: { current: ['district1', 'district2'] },
        schools: { current: ['school1', 'school2'] },
        classes: { current: ['class1', 'class2'] },
      };

      const adminOrgs = {
        districts: ['district1', 'district3'],
        schools: ['school2', 'school3'],
        classes: ['class1', 'class3'],
      };

      const result = adminOrgIntersection(participantData, adminOrgs);

      expect(result).toEqual({
        districts: ['district1'],
        schools: ['school2'],
        classes: ['class1'],
      });
    });
  });

  describe('highestAdminOrgIntersection', () => {
    it('should return highest org type with intersection', () => {
      const participantData = {
        districts: { current: [] },
        schools: { current: ['school1', 'school2'] },
        classes: { current: ['class1', 'class2'] },
      };

      const adminOrgs = {
        districts: ['district1', 'district3'],
        schools: ['school2', 'school3'],
        classes: ['class1', 'class3'],
      };

      const result = highestAdminOrgIntersection(participantData, adminOrgs);

      expect(result).toEqual({
        orgType: 'schools',
        orgIds: ['school2'],
      });
    });
  });
});
