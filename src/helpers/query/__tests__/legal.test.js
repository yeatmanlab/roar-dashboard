import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLegalDocs } from '../legal';
import { convertValues, getAxiosInstance } from '../utils';

vi.mock('lodash/capitalize', () => ({
  default: vi.fn((str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()),
}));

const mockGet = vi.fn();

vi.mock('../utils', () => ({
  getAxiosInstance: vi.fn(() => ({
    get: mockGet,
  })),
  convertValues: vi.fn((val) => {
    if (val?.stringValue) return val.stringValue;
    if (val?.mapValue?.fields) {
      const result = {};
      Object.entries(val.mapValue.fields).forEach(([key, value]) => {
        result[key] = value.stringValue || value;
      });
      return result;
    }
    return val;
  }),
}));

describe('query/legal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockDate = new Date('2023-01-01T12:00:00Z');
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
  });

  describe('fetchLegalDocs', () => {
    it('should fetch and process legal documents', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          documents: [
            {
              name: 'projects/test/databases/test/documents/legal/privacy',
              createTime: '2023-01-01T00:00:00Z',
              fields: {
                fileName: { stringValue: 'privacy.md' },
                gitHubOrg: { stringValue: 'yeatmanlab' },
                gitHubRepository: { stringValue: 'roar-legal' },
                currentCommit: { stringValue: 'abc123' },
                params: {
                  mapValue: {
                    fields: {
                      version: { stringValue: '1.0' },
                    },
                  },
                },
              },
            },
            {
              name: 'projects/test/databases/test/documents/legal/terms',
              createTime: '2023-01-02T00:00:00Z',
              fields: {
                fileName: { stringValue: 'terms.md' },
                gitHubOrg: { stringValue: 'yeatmanlab' },
                gitHubRepository: { stringValue: 'roar-legal' },
                currentCommit: { stringValue: 'def456' },
                params: {
                  mapValue: {
                    fields: {
                      version: { stringValue: '1.1' },
                    },
                  },
                },
              },
            },
          ],
        },
      });

      const result = await fetchLegalDocs();

      expect(getAxiosInstance).toHaveBeenCalledWith('admin');
      expect(mockGet).toHaveBeenCalledWith('/legal');
      expect(result).toHaveLength(2);

      expect(result[0].type).toBe('Privacy');
      expect(result[0].fileName).toBe('privacy.md');
      expect(result[0].gitHubOrg).toBe('yeatmanlab');
      expect(result[0].gitHubRepository).toBe('roar-legal');
      expect(result[0].currentCommit).toBe('abc123');
      expect(result[0].lastUpdated).toBe('1/1/2023, 12:00:00 PM');
      expect(result[0].params).toEqual({ version: '1.0' });

      expect(result[1].type).toBe('Terms');
      expect(result[1].fileName).toBe('terms.md');
    });

    it('should handle empty response', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          documents: [],
        },
      });

      const result = await fetchLegalDocs();

      expect(result).toEqual([]);
    });
  });
});
