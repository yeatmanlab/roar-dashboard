import { describe, it, expect } from 'vitest';
import { formatListArray } from './formatListArray';

describe('formatListArray', () => {
  const mockTaskLookup = {
    letter: { name: 'Letter Names and Sounds', category: 'foundational' },
    pa: { name: 'Phonological Awareness', category: 'foundational' },
    swr: { name: 'Single Word Recognition', category: 'reading' },
    sre: { name: 'Sentence Reading Efficiency', category: 'reading' },
  };

  const mockTaskOrderLookup = {
    letter: 1,
    pa: 2,
    swr: 3,
    sre: 4,
  };

  const simpleDisplayMapper = (item, entry) => entry?.name || item;
  const categoryDisplayMapper = (item, entry) => (entry ? `${entry.name} (${entry.category})` : item);

  describe('Basic functionality', () => {
    it('should return empty array for empty input', () => {
      const result = formatListArray([], mockTaskLookup, simpleDisplayMapper);
      expect(result).toEqual([]);
    });

    it('should return empty array for null input', () => {
      const result = formatListArray(null, mockTaskLookup, simpleDisplayMapper);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      const result = formatListArray(undefined, mockTaskLookup, simpleDisplayMapper);
      expect(result).toEqual([]);
    });

    it('should format an array with original order when no sorting specified', () => {
      const result = formatListArray(['swr', 'letter', 'pa'], mockTaskLookup, simpleDisplayMapper);
      expect(result).toEqual(['Single Word Recognition', 'Letter Names and Sounds', 'Phonological Awareness']);
    });

    it('should format a single item', () => {
      const result = formatListArray(['letter'], mockTaskLookup, simpleDisplayMapper);
      expect(result).toEqual(['Letter Names and Sounds']);
    });
  });

  describe('Display mapping', () => {
    it('should use display mapper to format array', () => {
      const result = formatListArray(['letter', 'swr'], mockTaskLookup, categoryDisplayMapper);
      expect(result).toEqual([
        'Letter Names and Sounds (foundational)',
        'Single Word Recognition (reading)',
      ]);
    });

    it('should handle missing lookup entries gracefully', () => {
      const items = ['letter', 'unknown-task'];
      const result = formatListArray(items, mockTaskLookup, simpleDisplayMapper);
      expect(result).toEqual(['Letter Names and Sounds', 'unknown-task']);
    });

    it('should pass both item and lookup entry to display mapper', () => {
      const customMapper = (item, entry) => {
        if (!entry) return `Missing: ${item}`;
        return `${item} -> ${entry.name}`;
      };

      const result = formatListArray(['letter', 'missing-task'], mockTaskLookup, customMapper);
      expect(result).toEqual(['letter -> Letter Names and Sounds', 'Missing: missing-task']);
    });
  });

  describe('Ordering with orderLookup', () => {
    it('should sort using orderLookup', () => {
      const result = formatListArray(['swr', 'letter', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: mockTaskOrderLookup,
      });
      expect(result).toEqual(['Letter Names and Sounds', 'Phonological Awareness', 'Single Word Recognition']);
    });

    it('should handle missing order values by defaulting to 0', () => {
      const partialOrderLookup = {
        letter: 2,
        pa: 1,
        // swr missing - should default to 0
      };

      const result = formatListArray(['letter', 'pa', 'swr'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: partialOrderLookup,
      });
      expect(result).toEqual(['Single Word Recognition', 'Phonological Awareness', 'Letter Names and Sounds']);
    });

    it('should handle null/undefined order values by defaulting to 0', () => {
      const orderLookupWithNulls = {
        letter: 2,
        pa: null,
        swr: undefined,
        sre: 1,
      };

      const result = formatListArray(['letter', 'pa', 'swr', 'sre'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: orderLookupWithNulls,
      });
      expect(result).toEqual([
        'Phonological Awareness',
        'Single Word Recognition',
        'Sentence Reading Efficiency',
        'Letter Names and Sounds',
      ]);
    });

    it('should handle non-numeric order values by defaulting to 0', () => {
      const invalidOrderLookup = {
        letter: 'invalid',
        pa: 1,
      };

      const result = formatListArray(['letter', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: invalidOrderLookup,
      });
      expect(result).toEqual(['Letter Names and Sounds', 'Phonological Awareness']);
    });

    it('should preserve original order for items with same weight', () => {
      const sameWeightLookup = {
        letter: 1,
        pa: 1,
        swr: 1,
      };

      const result = formatListArray(['swr', 'letter', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: sameWeightLookup,
      });
      // Should preserve the original order when weights are equal
      expect(result).toEqual(['Single Word Recognition', 'Letter Names and Sounds', 'Phonological Awareness']);
    });
  });

  describe('Ordering with orderExtractor', () => {
    it('should use orderExtractor function for custom sorting', () => {
      const orderExtractor = (item, entry) => {
        // Sort by category, then by name length
        const categoryOrder = { foundational: 1, reading: 2 };
        return categoryOrder[entry?.category] || 0;
      };

      const result = formatListArray(['swr', 'letter', 'pa', 'sre'], mockTaskLookup, simpleDisplayMapper, {
        orderExtractor,
      });

      // Should group by category: foundational (letter, pa), then reading (swr, sre)
      expect(result).toEqual([
        'Letter Names and Sounds',
        'Phonological Awareness',
        'Single Word Recognition',
        'Sentence Reading Efficiency',
      ]);
    });

    it('should prefer orderExtractor over orderLookup when both provided', () => {
      const orderExtractor = (item) => {
        // Reverse the order
        const order = { swr: 1, pa: 2, letter: 3 };
        return order[item] || 0;
      };

      const result = formatListArray(['letter', 'pa', 'swr'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: mockTaskOrderLookup, // This should be ignored
        orderExtractor,
      });

      expect(result).toEqual(['Single Word Recognition', 'Phonological Awareness', 'Letter Names and Sounds']);
    });

    it('should handle orderExtractor with missing entries', () => {
      const orderExtractor = (item, entry) => {
        if (!entry) return 999; // Put missing items at the end
        return entry.category === 'foundational' ? 1 : 2;
      };

      const result = formatListArray(['swr', 'letter', 'unknown', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        orderExtractor,
      });

      expect(result).toEqual([
        'Letter Names and Sounds',
        'Phonological Awareness',
        'Single Word Recognition',
        'unknown',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should handle array with duplicate items', () => {
      const result = formatListArray(['letter', 'letter', 'pa'], mockTaskLookup, simpleDisplayMapper);
      expect(result).toEqual(['Letter Names and Sounds', 'Letter Names and Sounds', 'Phonological Awareness']);
    });

    it('should handle empty lookup object', () => {
      const result = formatListArray(['letter', 'pa'], {}, simpleDisplayMapper);
      expect(result).toEqual(['letter', 'pa']);
    });

    it('should handle null lookup object', () => {
      const result = formatListArray(['letter', 'pa'], null, simpleDisplayMapper);
      expect(result).toEqual(['letter', 'pa']);
    });

    it('should not mutate the original array', () => {
      const originalItems = ['swr', 'letter', 'pa'];
      const itemsCopy = [...originalItems];

      formatListArray(originalItems, mockTaskLookup, simpleDisplayMapper, {
        orderLookup: mockTaskOrderLookup,
      });

      expect(originalItems).toEqual(itemsCopy);
    });

    it('should handle very large arrays efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      const largeLookup = {};
      largeArray.forEach((item, i) => {
        largeLookup[item] = { name: `Name ${i}`, order: Math.floor(Math.random() * 100) };
      });

      const result = formatListArray(largeArray, largeLookup, simpleDisplayMapper);

      expect(result).toHaveLength(1000);
      expect(result[0]).toContain('Name');
    });
  });
});
