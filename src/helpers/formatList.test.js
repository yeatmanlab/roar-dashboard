import { describe, it, expect } from 'vitest';
import { formatList } from './formatList';

describe('formatList', () => {
  const mockTaskLookup = {
    letter: { name: 'Letter Names and Sounds', category: 'foundational', difficulty: 'basic' },
    pa: { name: 'Phonological Awareness', category: 'foundational', difficulty: 'basic' },
    swr: { name: 'Single Word Recognition', category: 'reading', difficulty: 'intermediate' },
    sre: { name: 'Sentence Reading Efficiency', category: 'reading', difficulty: 'advanced' },
    morphology: { name: 'Morphological Awareness', category: 'language', difficulty: 'advanced' },
  };

  const mockTaskOrderLookup = {
    letter: 1,
    pa: 3,
    swr: 5,
    sre: 7,
    morphology: 9,
  };

  const simpleDisplayMapper = (item, entry) => entry?.name || item;
  const categoryDisplayMapper = (item, entry) => `${entry?.name} (${entry?.category})`;

  it('should return empty string for empty array', () => {
    const result = formatList([], mockTaskLookup, simpleDisplayMapper);
    expect(result).toBe('');
  });

  it('should return empty string for null/undefined items', () => {
    expect(formatList(null, mockTaskLookup, simpleDisplayMapper)).toBe('');
    expect(formatList(undefined, mockTaskLookup, simpleDisplayMapper)).toBe('');
  });

  it('should return empty string for non-array items', () => {
    expect(formatList('not-array', mockTaskLookup, simpleDisplayMapper)).toBe('');
    expect(formatList({}, mockTaskLookup, simpleDisplayMapper)).toBe('');
    expect(formatList(123, mockTaskLookup, simpleDisplayMapper)).toBe('');
  });

  it('should format a list correctly', () => {
    const result = formatList(['letter'], mockTaskLookup, simpleDisplayMapper);
    expect(result).toBe('Letter Names and Sounds');
  });

  it('should format a list with default separator', () => {
    const result = formatList(['letter', 'pa'], mockTaskLookup, simpleDisplayMapper);
    expect(result).toBe('Letter Names and Sounds, Phonological Awareness');
  });

  it('should format a list with its original order when no sorting specified', () => {
    const result = formatList(['swr', 'letter', 'pa'], mockTaskLookup, simpleDisplayMapper);
    expect(result).toBe('Single Word Recognition, Letter Names and Sounds, Phonological Awareness');
  });

  describe('Display mapping', () => {
    it('should use display mapper to format list', () => {
      const result = formatList(['letter', 'swr'], mockTaskLookup, categoryDisplayMapper);
      expect(result).toBe('Letter Names and Sounds (foundational), Single Word Recognition (reading)');
    });

    it('should handle missing lookup entries gracefully', () => {
      const items = ['letter', 'unknown-task'];
      const result = formatList(items, mockTaskLookup, simpleDisplayMapper);
      expect(result).toBe('Letter Names and Sounds, unknown-task');
    });

    it('should pass both item and lookup entry to display mapper', () => {
      const customMapper = (item, entry) => {
        if (!entry) return `Missing: ${item}`;
        return `${item} -> ${entry.name}`;
      };

      const result = formatList(['letter', 'missing-task'], mockTaskLookup, customMapper);
      expect(result).toBe('letter -> Letter Names and Sounds, Missing: missing-task');
    });
  });

  describe('Ordering with orderLookup', () => {
    it('should sort using orderLookup', () => {
      const result = formatList(['swr', 'letter', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: mockTaskOrderLookup,
      });
      expect(result).toBe('Letter Names and Sounds, Phonological Awareness, Single Word Recognition');
    });

    it('should handle missing order values by defaulting to 0', () => {
      const partialOrderLookup = {
        letter: 2,
        pa: 1,
        // swr missing - should default to 0
      };

      const result = formatList(['letter', 'pa', 'swr'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: partialOrderLookup,
      });
      expect(result).toBe('Single Word Recognition, Phonological Awareness, Letter Names and Sounds');
    });

    it('should handle null/undefined order values by defaulting to 0', () => {
      const orderLookupWithNulls = {
        letter: 2,
        pa: null,
        swr: undefined,
        sre: 1,
      };

      const result = formatList(['letter', 'pa', 'swr', 'sre'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: orderLookupWithNulls,
      });
      expect(result).toBe(
        'Phonological Awareness, Single Word Recognition, Sentence Reading Efficiency, Letter Names and Sounds',
      );
    });

    it('should handle non-numeric order values by defaulting to 0', () => {
      const invalidOrderLookup = {
        letter: 'invalid',
        pa: 1,
        swr: {},
      };

      const result = formatList(['letter', 'pa', 'swr'], mockTaskLookup, simpleDisplayMapper, {
        orderLookup: invalidOrderLookup,
      });
      expect(result).toBe('Letter Names and Sounds, Single Word Recognition, Phonological Awareness');
    });
  });

  describe('Ordering with orderExtractor', () => {
    it('should sort items using orderExtractor function', () => {
      const orderExtractor = (item, entry) => {
        const priorities = { foundational: 1, reading: 2, language: 3 };
        return priorities[entry?.category] || 0;
      };

      const result = formatList(['morphology', 'letter', 'swr'], mockTaskLookup, simpleDisplayMapper, {
        orderExtractor,
      });
      expect(result).toBe('Letter Names and Sounds, Single Word Recognition, Morphological Awareness');
    });

    it('should handle orderExtractor returning non-numeric values', () => {
      const orderExtractor = () => 'invalid';

      const result = formatList(['letter', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        orderExtractor,
      });

      expect(result).toContain('Letter Names and Sounds');
      expect(result).toContain('Phonological Awareness');
    });
  });

  describe('Custom options', () => {
    it('should use custom separator', () => {
      const result = formatList(['letter', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        separator: ' | ',
      });
      expect(result).toBe('Letter Names and Sounds | Phonological Awareness');
    });

    it('should use custom suffix', () => {
      const result = formatList(['letter', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        suffix: '.',
      });
      expect(result).toBe('Letter Names and Sounds, Phonological Awareness.');
    });

    it('should combine custom separator and suffix', () => {
      const result = formatList(['letter', 'pa', 'swr'], mockTaskLookup, simpleDisplayMapper, {
        separator: ' & ',
        suffix: '!',
      });
      expect(result).toBe('Letter Names and Sounds & Phonological Awareness & Single Word Recognition!');
    });

    it('should handle empty string separator', () => {
      const result = formatList(['letter', 'pa'], mockTaskLookup, simpleDisplayMapper, {
        separator: '',
      });
      expect(result).toBe('Letter Names and SoundsPhonological Awareness');
    });

    it('should handle empty string suffix', () => {
      const result = formatList(['letter'], mockTaskLookup, simpleDisplayMapper, {
        suffix: '',
      });
      expect(result).toBe('Letter Names and Sounds');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle all options together', () => {
      const result = formatList(['morphology', 'letter', 'swr'], mockTaskLookup, categoryDisplayMapper, {
        orderLookup: mockTaskOrderLookup,
        separator: ' -> ',
        suffix: ' [END]',
      });
      expect(result).toBe(
        'Letter Names and Sounds (foundational) -> Single Word Recognition (reading) -> Morphological Awareness (language) [END]',
      );
    });

    it('should preserve original array (not mutate)', () => {
      const originalItems = ['morphology', 'letter', 'swr'];
      const itemsCopy = [...originalItems];

      formatList(originalItems, mockTaskLookup, simpleDisplayMapper, {
        orderLookup: mockTaskOrderLookup,
      });

      expect(originalItems).toEqual(itemsCopy);
    });

    it('should handle large arrays efficiently', () => {
      const largeItems = Array.from({ length: 1000 }, (_, i) => `item${i}`);
      const largeLookup = Object.fromEntries(largeItems.map((item) => [item, { name: item.toUpperCase() }]));
      const largeOrderLookup = Object.fromEntries(largeItems.map((item, i) => [item, 1000 - i]));

      const result = formatList(largeItems.slice(0, 5), largeLookup, simpleDisplayMapper, {
        orderLookup: largeOrderLookup,
      });

      expect(result).toContain('ITEM4, ITEM3, ITEM2, ITEM1, ITEM0');
    });

    it('should handle items with special characters in names', () => {
      const specialLookup = {
        'item-1': { name: 'Item #1 (Special)' },
        item_2: { name: 'Item & Two' },
        'item.3': { name: 'Item "Three"' },
      };

      const result = formatList(['item-1', 'item_2', 'item.3'], specialLookup, simpleDisplayMapper);
      expect(result).toBe('Item #1 (Special), Item & Two, Item "Three"');
    });
  });

  describe('edge cases', () => {
    it('should handle empty lookup object', () => {
      const result = formatList(['letter', 'pa'], {}, simpleDisplayMapper);
      expect(result).toBe('letter, pa');
    });

    it('should handle null lookup object', () => {
      const result = formatList(['letter', 'pa'], null, simpleDisplayMapper);
      expect(result).toBe('letter, pa');
    });

    it('should handle display mapper that returns empty string', () => {
      const emptyMapper = () => '';
      const result = formatList(['letter', 'pa'], mockTaskLookup, emptyMapper);
      expect(result).toBe(', ');
    });

    it('should handle display mapper that returns null/undefined', () => {
      const nullMapper = () => null;
      const result = formatList(['letter'], mockTaskLookup, nullMapper);
      expect(result).toBe('');
    });

    it('should handle items array with duplicate values', () => {
      const result = formatList(['letter', 'letter', 'pa'], mockTaskLookup, simpleDisplayMapper);
      expect(result).toBe('Letter Names and Sounds, Letter Names and Sounds, Phonological Awareness');
    });

    it('should handle mixed data types in items array', () => {
      const mixedLookup = {
        1: { name: 'One' },
        string: { name: 'String' },
        true: { name: 'Boolean' },
      };

      const result = formatList([1, 'string', true], mixedLookup, simpleDisplayMapper);
      expect(result).toBe('One, String, Boolean');
    });
  });
});
