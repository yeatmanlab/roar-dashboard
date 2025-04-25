import { describe, it, expect, vi } from 'vitest';
import {
  flattenObj,
  findById,
  upsert,
  arrayRandom,
  getUniquePropsFromUsers,
  userHasSelectedOrgs,
  formatDate,
  csvFileToJson,
  standardDeviation,
  filterAdminOrgs,
  removeEmptyOrgs,
  pluralizeFirestoreCollection,
  singularizeFirestoreCollection,
} from './index';
import Papa from 'papaparse';

const mockPapaState = {
  shouldFail: false,
};

vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn().mockImplementation((file, options) => {
      if (mockPapaState.shouldFail) {
        options.complete({
          data: [],
          errors: [{ message: 'Error parsing CSV' }],
        });
      } else {
        options.complete({
          data: [{ name: 'Test', value: 123 }],
          errors: [],
        });
      }
      return { abort: vi.fn() };
    }),
    unparse: vi.fn().mockReturnValue('csv-content'),
  },
  parse: vi.fn().mockImplementation((file, options) => {
    if (mockPapaState.shouldFail) {
      options.complete({
        data: [],
        errors: [{ message: 'Error parsing CSV' }],
      });
    } else {
      options.complete({
        data: [{ name: 'Test', value: 123 }],
        errors: [],
      });
    }
    return { abort: vi.fn() };
  }),
  unparse: vi.fn().mockReturnValue('csv-content'),
}));

describe('index helpers', () => {
  describe('flattenObj', () => {
    it('should flatten a nested object', () => {
      const obj = {
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'New York',
          location: {
            lat: 40.7128,
            lng: -74.006,
          },
        },
      };

      const result = flattenObj(obj);

      expect(result).toEqual({
        name: 'John',
        'address.street': '123 Main St',
        'address.city': 'New York',
        'address.location.lat': 40.7128,
        'address.location.lng': -74.006,
      });
    });

    it('should handle arrays in objects', () => {
      const obj = {
        name: 'John',
        hobbies: ['reading', 'swimming'],
      };

      const result = flattenObj(obj);

      expect(result).toEqual({
        name: 'John',
        hobbies: ['reading', 'swimming'],
      });
    });

    it('should handle empty objects', () => {
      const result = flattenObj({});
      expect(result).toEqual({});
    });

    it('should handle null values', () => {
      const obj = {
        name: 'John',
        address: null,
      };

      const result = flattenObj(obj);

      expect(result).toEqual({
        name: 'John',
        address: '',
      });
    });
  });

  describe('findById', () => {
    it('should find an object by id', () => {
      const resources = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
      ];

      const result = findById(resources, '2');
      expect(result).toEqual({ id: '2', name: 'Item 2' });
    });

    it('should return null if resources is null or undefined', () => {
      expect(findById(null, '1')).toBeNull();
      expect(findById(undefined, '1')).toBeNull();
    });

    it('should return undefined if id is not found', () => {
      const resources = [{ id: '1', name: 'Item 1' }];
      expect(findById(resources, '2')).toBeUndefined();
    });
  });

  describe('upsert', () => {
    it('should update an existing resource', () => {
      const resources = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];

      const resource = { id: '2', name: 'Updated Item 2' };
      upsert(resources, resource);

      expect(resources).toEqual([
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Updated Item 2' },
      ]);
    });

    it('should insert a new resource if id does not exist', () => {
      const resources = [{ id: '1', name: 'Item 1' }];

      const resource = { id: '2', name: 'Item 2' };
      upsert(resources, resource);

      expect(resources).toEqual([
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]);
    });

    it('should insert a resource without id', () => {
      const resources = [{ id: '1', name: 'Item 1' }];

      const resource = { name: 'Item 2' };
      upsert(resources, resource);

      expect(resources).toEqual([{ id: '1', name: 'Item 1' }, { name: 'Item 2' }]);
    });
  });

  describe('arrayRandom', () => {
    it('should return a random element from the array', () => {
      const array = [1, 2, 3, 4, 5];

      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.5);

      const result = arrayRandom(array);

      expect(result).toBe(3); // 0.5 * 5 = 2.5, Math.floor(2.5) = 2, array[2] = 3

      Math.random = originalRandom;
    });
  });

  describe('getUniquePropsFromUsers', () => {
    it('should return unique properties from users', () => {
      const users = [
        { id: '1', roles: ['admin', 'user'] },
        { id: '2', roles: ['user'] },
        { id: '3', roles: ['admin', 'editor'] },
      ];

      const result = getUniquePropsFromUsers(users, 'roles');

      expect(result).toEqual([{ id: 'admin' }, { id: 'user' }, { id: 'editor' }]);
    });
  });

  describe('userHasSelectedOrgs', () => {
    it('should return true if user has selected orgs', () => {
      const userArray = ['org1', 'org2', 'org3'];
      const selections = [{ id: 'org1' }, { id: 'org4' }];

      const result = userHasSelectedOrgs(userArray, selections);

      expect(result).toBe(true);
    });

    it('should return false if user has no selected orgs', () => {
      const userArray = ['org1', 'org2', 'org3'];
      const selections = [{ id: 'org4' }, { id: 'org5' }];

      const result = userHasSelectedOrgs(userArray, selections);

      expect(result).toBe(false);
    });

    it('should return true if selections is empty', () => {
      const userArray = ['org1', 'org2', 'org3'];
      const selections = [];

      const result = userHasSelectedOrgs(userArray, selections);

      expect(result).toBe(true);
    });
  });

  describe('formatDate', () => {
    it('should format a date', () => {
      const date = new Date('2023-01-01T12:00:00Z');

      const originalToLocaleString = Date.prototype.toLocaleString;
      Date.prototype.toLocaleString = vi.fn().mockReturnValue('1/1/2023, 12:00:00 PM');

      const result = formatDate(date);

      expect(result).toBe('1/1/2023, 12:00:00 PM');

      Date.prototype.toLocaleString = originalToLocaleString;
    });

    it('should handle undefined date', () => {
      expect(formatDate(undefined)).toBeUndefined();
    });
  });

  describe('csvFileToJson', () => {
    it('should parse CSV file to JSON', async () => {
      global.File = class File {
        constructor(content, name, options) {
          this.content = content;
          this.name = name;
          this.type = options.type;
        }
      };

      const fileObject = new File(['name,value\nTest,123'], 'test.csv', { type: 'text/csv' });

      const originalParse = Papa.parse;
      Papa.parse = vi.fn((file, options) => {
        setTimeout(() => {
          options.complete({
            data: [{ name: 'Test', value: 123 }],
            errors: [],
          });
        }, 0);
        return { abort: vi.fn() };
      });

      const result = await csvFileToJson(fileObject);

      expect(result).toEqual([{ name: 'Test', value: 123 }]);

      Papa.parse = originalParse;
    });

    it('should reject if there are errors', async () => {
      global.File = class File {
        constructor(content, name, options) {
          this.content = content;
          this.name = name;
          this.type = options.type;
        }
      };

      const fileObject = new File(['invalid'], 'test.csv', { type: 'text/csv' });

      mockPapaState.shouldFail = true;

      await expect(csvFileToJson(fileObject)).rejects.toEqual([{ message: 'Error parsing CSV' }]);

      mockPapaState.shouldFail = false;
    });
  });

  describe('standardDeviation', () => {
    it('should calculate standard deviation', () => {
      const arr = [2, 4, 6, 8, 10];

      const result = standardDeviation(arr);

      expect(result).toBeCloseTo(3.16, 1);
    });

    it('should calculate population standard deviation when usePopulation is true', () => {
      const arr = [2, 4, 6, 8, 10];

      const result = standardDeviation(arr, true);

      expect(result).toBeCloseTo(2.83, 1);
    });

    it('should return Infinity for empty array', () => {
      expect(standardDeviation([])).toBe(Infinity);
    });
  });

  describe('pluralizeFirestoreCollection', () => {
    it('should pluralize a singular collection name', () => {
      expect(pluralizeFirestoreCollection('user')).toBe('users');
      expect(pluralizeFirestoreCollection('group')).toBe('groups');
    });

    it('should return the same string if already plural', () => {
      expect(pluralizeFirestoreCollection('users')).toBe('users');
    });

    it('should throw error for unknown collection', () => {
      expect(() => pluralizeFirestoreCollection('unknown')).toThrow();
    });
  });

  describe('singularizeFirestoreCollection', () => {
    it('should singularize a plural collection name', () => {
      expect(singularizeFirestoreCollection('users')).toBe('user');
      expect(singularizeFirestoreCollection('groups')).toBe('group');
    });

    it('should return the same string if already singular', () => {
      expect(singularizeFirestoreCollection('user')).toBe('user');
    });

    it('should throw error for unknown collection', () => {
      expect(() => singularizeFirestoreCollection('unknown')).toThrow();
    });
  });
});
