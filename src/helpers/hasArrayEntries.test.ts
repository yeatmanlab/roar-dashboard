import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { hasArrayEntries } from './hasArrayEntries';

describe('hasArrayEntries', () => {
  it('should return true for non-empty arrays', () => {
    expect(hasArrayEntries([1, 2, 3])).toBe(true);
  });

  it('should return false for empty arrays', () => {
    expect(hasArrayEntries([])).toBe(false);
  });

  it('should return false for null', () => {
    expect(hasArrayEntries(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(hasArrayEntries(undefined)).toBe(false);
  });

  it('should return true for non-empty Vue ref with arrays', () => {
    const refWithArray = ref([1, 2, 3]);
    expect(hasArrayEntries(refWithArray)).toBe(true);
  });

  it('should return false for empty Vue ref with arrays', () => {
    const emptyRefWithArray = ref([]);
    expect(hasArrayEntries(emptyRefWithArray)).toBe(false);
  });

  it('should return false for Vue ref with null', () => {
    const refWithNull = ref(null);
    expect(hasArrayEntries(refWithNull)).toBe(false);
  });

  it('should return false for Vue ref with undefined', () => {
    const refWithUndefined = ref(undefined);
    expect(hasArrayEntries(refWithUndefined)).toBe(false);
  });
});
