import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActivationCodesRequestBody, getActivationCodesByOrgId } from '../activationCodes';
import { getAxiosInstance } from '../utils';

vi.mock('vue', () => ({
  toValue: vi.fn((val) => val),
}));

vi.mock('../../../constants/firebase', () => ({
  FIRESTORE_COLLECTIONS: {
    ACTIVATION_CODES: 'activationCodes',
  },
}));

const mockPost = vi.fn().mockResolvedValue({
  data: [
    {
      document: {
        name: 'projects/test/databases/test/documents/activationCodes/code1',
        fields: {
          code: { stringValue: 'ABC123' },
          orgId: { stringValue: 'org1' },
          used: { booleanValue: false },
        },
      },
    },
  ],
});

vi.mock('../utils', () => ({
  getAxiosInstance: vi.fn(() => ({
    post: mockPost,
  })),
}));

describe('query/activationCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActivationCodesRequestBody', () => {
    it('should create a request body with correct structure', () => {
      const orgId = 'org1';
      const result = getActivationCodesRequestBody({ orgId });

      expect(result.structuredQuery.from[0].collectionId).toBe('activationCodes');
      expect(result.structuredQuery.where.fieldFilter.field.fieldPath).toBe('orgId');
      expect(result.structuredQuery.where.fieldFilter.op).toBe('EQUAL');
      expect(result.structuredQuery.where.fieldFilter.value.stringValue).toBe('org1');
    });
  });

  describe('getActivationCodesByOrgId', () => {
    it('should call getAxiosInstance and post with correct parameters', async () => {
      const orgId = 'org1';
      const result = await getActivationCodesByOrgId(orgId);

      expect(getAxiosInstance).toHaveBeenCalledWith('admin');
      expect(mockPost).toHaveBeenCalledWith('/:runQuery', expect.any(Object));
      expect(result).toEqual([
        {
          document: {
            name: 'projects/test/databases/test/documents/activationCodes/code1',
            fields: {
              code: { stringValue: 'ABC123' },
              orgId: { stringValue: 'org1' },
              used: { booleanValue: false },
            },
          },
        },
      ]);
    });
  });
});
