import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertValues, mapFields, exportCsv, matchMode2Op } from '../utils';
import Papa from 'papaparse';

vi.mock('vue', () => ({
  toValue: vi.fn((val) => val),
}));

vi.mock('papaparse', () => ({
  default: {
    unparse: vi.fn().mockReturnValue('csv-content'),
  },
  unparse: vi.fn().mockReturnValue('csv-content'),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('pinia', () => ({
  storeToRefs: vi.fn(),
}));

describe('query/utils', () => {
  global.document = {
    createElement: vi.fn().mockReturnValue({
      href: '',
      download: '',
      click: vi.fn(),
    }),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  };

  global.URL = {
    createObjectURL: vi.fn().mockReturnValue('blob-url'),
  };

  global.Blob = vi.fn().mockImplementation((content) => ({
    content,
    size: 123,
    type: 'application/octet-stream',
  }));

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('convertValues', () => {
    it('should handle stringValue', () => {
      const value = { stringValue: 'test' };
      const result = convertValues(value);
      expect(result).toBe('test');
    });

    it('should handle booleanValue', () => {
      const value = { booleanValue: true };
      const result = convertValues(value);
      expect(result).toBe(true);
    });

    it('should handle numberValue', () => {
      const value = { integerValue: '123' };
      const result = convertValues(value);
      expect(result).toBe(123);
    });

    it('should handle doubleValue', () => {
      const value = { doubleValue: '123.45' };
      const result = convertValues(value);
      expect(result).toBe(123.45);
    });

    it('should handle arrayValue', () => {
      const value = {
        arrayValue: {
          values: [{ stringValue: 'test1' }, { integerValue: '123' }],
        },
      };
      const result = convertValues(value);
      expect(result).toEqual(['test1', 123]);
    });

    it('should handle empty arrayValue', () => {
      const value = { arrayValue: {} };
      const result = convertValues(value);
      expect(result).toEqual([]);
    });

    it('should handle mapValue', () => {
      const value = {
        mapValue: {
          fields: {
            name: { stringValue: 'test' },
            age: { integerValue: '30' },
          },
        },
      };
      const result = convertValues(value);
      expect(result).toEqual({ name: 'test', age: 30 });
    });
  });

  describe('mapFields', () => {
    it('should map fields from array of documents', () => {
      const data = [
        {
          document: {
            name: 'projects/test/databases/test/documents/collection/doc1',
            fields: {
              name: { stringValue: 'Document 1' },
              value: { integerValue: '10' },
            },
          },
        },
        {
          document: {
            name: 'projects/test/databases/test/documents/collection/doc2',
            fields: {
              name: { stringValue: 'Document 2' },
              value: { integerValue: '20' },
            },
          },
        },
      ];

      const result = mapFields(data);
      expect(result).toEqual([
        { name: 'Document 1', value: 10, id: 'doc1' },
        { name: 'Document 2', value: 20, id: 'doc2' },
      ]);
    });

    it('should add parentDoc field when getParentDocId is true', () => {
      const data = [
        {
          document: {
            name: 'projects/test/databases/test/documents/collection/parent/subcollection/doc1',
            fields: {
              name: { stringValue: 'Document 1' },
            },
          },
        },
      ];

      const result = mapFields(data, true);
      expect(result[0]).toHaveProperty('parentDoc', 'parent');
    });

    it('should handle undefined document fields', () => {
      const data = [
        { notADocument: true },
        {
          document: {
            name: 'projects/test/databases/test/documents/collection/doc1',
            fields: {
              name: { stringValue: 'Document 1' },
            },
          },
        },
      ];

      const result = mapFields(data);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'Document 1');
    });
  });

  describe('exportCsv', () => {
    it('should export data as CSV', () => {
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      document.createElement = vi.fn().mockReturnValue(mockAnchor);

      URL.createObjectURL = vi.fn().mockReturnValue('blob-url');

      document.body = {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      };

      const data = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 },
      ];

      exportCsv(data, 'test.csv');

      expect(Papa.unparse).toHaveBeenCalled();
      expect(mockAnchor.href).toBe('blob-url');
      expect(mockAnchor.download).toBe('test.csv');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    });
  });

  describe('matchMode2Op', () => {
    it('should have correct mapping values', () => {
      expect(matchMode2Op).toEqual({
        equals: 'EQUAL',
        notEquals: 'NOT_EQUAL',
      });
    });
  });
});
