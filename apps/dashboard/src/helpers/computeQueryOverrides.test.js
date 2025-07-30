import { reactive } from 'vue';
import { describe, it, expect, vi } from 'vitest';
import { computeQueryOverrides } from './computeQueryOverrides';

describe('computeQueryOverrides', () => {
  it('should return isQueryEnabled as true when all conditions are met and enabled is not provided', () => {
    const conditions = [true, true];
    const { isQueryEnabled, options } = computeQueryOverrides(conditions, undefined);

    expect(isQueryEnabled.value).toBe(true);
    expect(options).toEqual({});
  });

  it('should return isQueryEnabled as false when any condition is not met', () => {
    const conditions = [true, false];
    const { isQueryEnabled } = computeQueryOverrides(conditions, undefined);

    expect(isQueryEnabled.value).toBe(false);
  });

  it('should return isQueryEnabled as true when all conditions are met and enabled is true', () => {
    const conditions = [true, true];
    const queryOptions = reactive({ enabled: true });
    const { isQueryEnabled } = computeQueryOverrides(conditions, queryOptions);

    expect(isQueryEnabled.value).toBe(true);
  });

  it('should return isQueryEnabled as false when all conditions are met but enabled is false', () => {
    const conditions = [true, true];
    const queryOptions = reactive({ enabled: false });
    const { isQueryEnabled } = computeQueryOverrides(conditions, queryOptions);

    expect(isQueryEnabled.value).toBe(false);
  });

  it('should return options without enabled property', () => {
    const conditions = [true, true];
    const queryOptions = { enabled: true, other: 'value' };
    const { options } = computeQueryOverrides(conditions, queryOptions);

    expect(options).toEqual({ other: 'value' });
  });

  it('should handle conditions as functions', () => {
    const mockFn1 = vi.fn(() => true);
    const mockFn2 = vi.fn(() => false);
    const conditions = [mockFn1, mockFn2];
    const { isQueryEnabled } = computeQueryOverrides(conditions, undefined);

    expect(isQueryEnabled.value).toBe(false);
    expect(mockFn1).toHaveBeenCalled();
    expect(mockFn2).toHaveBeenCalled();
  });
});
