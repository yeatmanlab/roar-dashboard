import { describe, it, expect } from 'vitest';
import { formatListArray } from './formatListArray';

describe('formatListArray', () => {
  describe('basic functionality', () => {
    it('should return empty array for empty input', () => {
      const result = formatListArray([], {}, (item) => item);
      expect(result).toEqual([]);
    });

    it('should return empty array for null input', () => {
      const result = formatListArray(null, {}, (item) => item);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      const result = formatListArray(undefined, {}, (item) => item);
      expect(result).toEqual([]);
    });

    it('should map items using displayMapper without lookup', () => {
      const items = ['a', 'b', 'c'];
      const result = formatListArray(items, {}, (item) => item.toUpperCase());
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('should map items using displayMapper with lookup', () => {
      const items = ['task1', 'task2'];
      const lookup = {
        task1: { name: 'Task One' },
        task2: { name: 'Task Two' },
      };
      const displayMapper = (item, entry) => entry?.name;
      const result = formatListArray(items, lookup, displayMapper);
      expect(result).toEqual(['Task One', 'Task Two']);
    });
  });

  describe('sorting with orderLookup', () => {
    it('should sort items by orderLookup values', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A' },
        b: { name: 'Item B' },
        c: { name: 'Item C' },
      };
      const orderLookup = {
        a: 1,
        b: 2,
        c: 3,
      };
      const displayMapper = (item, entry) => entry?.name;
      const result = formatListArray(items, lookup, displayMapper, { orderLookup });
      expect(result).toEqual(['Item A', 'Item B', 'Item C']);
    });

    it('should treat missing orderLookup values as 0', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A' },
        b: { name: 'Item B' },
        c: { name: 'Item C' },
      };
      const orderLookup = {
        a: 1,
        // b is missing, should default to 0
        c: 3,
      };
      const displayMapper = (item, entry) => entry?.name;
      const result = formatListArray(items, lookup, displayMapper, { orderLookup });
      expect(result).toEqual(['Item B', 'Item A', 'Item C']);
    });

    it('should treat non-numeric orderLookup values as 0', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A' },
        b: { name: 'Item B' },
        c: { name: 'Item C' },
      };
      const orderLookup = {
        a: 1,
        b: 'invalid',
        c: 3,
      };
      const displayMapper = (item, entry) => entry?.name;
      const result = formatListArray(items, lookup, displayMapper, { orderLookup });
      expect(result).toEqual(['Item B', 'Item A', 'Item C']);
    });

    it('should preserve original order for items with equal weights', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A' },
        b: { name: 'Item B' },
        c: { name: 'Item C' },
      };
      const orderLookup = {
        a: 1,
        b: 1,
        c: 1,
      };
      const displayMapper = (item, entry) => entry?.name;
      const result = formatListArray(items, lookup, displayMapper, { orderLookup });
      // V8's stable sort preserves original order for equal weights
      expect(result).toEqual(['Item C', 'Item A', 'Item B']);
    });
  });

  describe('sorting with orderExtractor', () => {
    it('should sort items using orderExtractor function', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A', order: 1 },
        b: { name: 'Item B', order: 2 },
        c: { name: 'Item C', order: 3 },
      };
      const displayMapper = (item, entry) => entry?.name;
      const orderExtractor = (item, entry) => entry?.order || 0;
      const result = formatListArray(items, lookup, displayMapper, { orderExtractor });
      expect(result).toEqual(['Item A', 'Item B', 'Item C']);
    });

    it('should prioritize orderExtractor over orderLookup', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A', order: 3 },
        b: { name: 'Item B', order: 2 },
        c: { name: 'Item C', order: 1 },
      };
      const orderLookup = {
        a: 1,
        b: 2,
        c: 3,
      };
      const displayMapper = (item, entry) => entry?.name;
      const orderExtractor = (item, entry) => entry?.order || 0;
      const result = formatListArray(items, lookup, displayMapper, { orderLookup, orderExtractor });
      // orderExtractor should take precedence
      expect(result).toEqual(['Item C', 'Item B', 'Item A']);
    });

    it('should handle missing entries in orderExtractor', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A', order: 1 },
        // b is missing from lookup
        c: { name: 'Item C', order: 3 },
      };
      const displayMapper = (item, entry) => entry?.name || `Unknown ${item}`;
      const orderExtractor = (item, entry) => entry?.order || 0;
      const result = formatListArray(items, lookup, displayMapper, { orderExtractor });
      expect(result).toEqual(['Unknown b', 'Item A', 'Item C']);
    });
  });

  describe('no sorting', () => {
    it('should preserve original order when no ordering options provided', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A' },
        b: { name: 'Item B' },
        c: { name: 'Item C' },
      };
      const displayMapper = (item, entry) => entry?.name;
      const result = formatListArray(items, lookup, displayMapper);
      expect(result).toEqual(['Item C', 'Item A', 'Item B']);
    });
  });

  describe('edge cases', () => {
    it('should handle items not in lookup', () => {
      const items = ['a', 'b', 'c'];
      const lookup = {
        a: { name: 'Item A' },
        // b and c are missing
      };
      const displayMapper = (item, entry) => entry?.name || `Missing: ${item}`;
      const result = formatListArray(items, lookup, displayMapper);
      expect(result).toEqual(['Item A', 'Missing: b', 'Missing: c']);
    });

    it('should handle null lookup', () => {
      const items = ['a', 'b', 'c'];
      const displayMapper = (item) => `Item ${item}`;
      const result = formatListArray(items, null, displayMapper);
      expect(result).toEqual(['Item a', 'Item b', 'Item c']);
    });

    it('should handle single item array', () => {
      const items = ['a'];
      const lookup = { a: { name: 'Single Item' } };
      const displayMapper = (item, entry) => entry?.name;
      const result = formatListArray(items, lookup, displayMapper);
      expect(result).toEqual(['Single Item']);
    });

    it('should handle negative order values', () => {
      const items = ['c', 'a', 'b'];
      const lookup = {
        a: { name: 'Item A' },
        b: { name: 'Item B' },
        c: { name: 'Item C' },
      };
      const orderLookup = {
        a: -1,
        b: 0,
        c: 1,
      };
      const displayMapper = (item, entry) => entry?.name;
      const result = formatListArray(items, lookup, displayMapper, { orderLookup });
      expect(result).toEqual(['Item A', 'Item B', 'Item C']);
    });
  });
});
