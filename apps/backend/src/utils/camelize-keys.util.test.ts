import { describe, it, expect } from 'vitest';
import { camelizeKeys } from './camelize-keys.util';

describe('camelizeKeys', () => {
  describe('key conversion', () => {
    it('converts a single snake_case key to camelCase', () => {
      expect(camelizeKeys({ foo_bar: 1 })).toEqual({ fooBar: 1 });
    });

    it('converts multiple snake_case keys', () => {
      expect(camelizeKeys({ first_name: 'a', last_name: 'b' })).toEqual({ firstName: 'a', lastName: 'b' });
    });

    it('leaves already-camelCase keys unchanged', () => {
      expect(camelizeKeys({ fooBar: 1 })).toEqual({ fooBar: 1 });
    });

    it('leaves keys with no underscores unchanged', () => {
      expect(camelizeKeys({ foo: 1 })).toEqual({ foo: 1 });
    });

    it('handles multi-segment snake_case keys', () => {
      expect(camelizeKeys({ one_two_three: true })).toEqual({ oneTwoThree: true });
    });

    it('converts _<digit> segments — theta_estimate_2 → thetaEstimate2', () => {
      expect(camelizeKeys({ theta_estimate_2: 0.5, theta_std_err_2: 0.1 })).toEqual({
        thetaEstimate2: 0.5,
        thetaStdErr2: 0.1,
      });
    });

    it('returns an empty object unchanged', () => {
      expect(camelizeKeys({})).toEqual({});
    });

    it('preserves values as-is', () => {
      const val = { nested: true };
      const result = camelizeKeys({ some_key: val });
      expect(result.someKey).toBe(val);
    });
  });

  describe('skipAliases option', () => {
    it('keeps the camelCase key when both forms are present and skipAliases is true', () => {
      // camelCase value is authoritative; snake_case entry is skipped
      const result = camelizeKeys({ rt: 100, response_time: 200, rt_adj: 300 }, { skipAliases: true });
      expect(result.rt).toBe(100);
      expect(result.responseTime).toBe(200);
      // rt_adj has no camelCase alias already present, so it converts normally
      expect(result.rtAdj).toBe(300);
    });

    it('skips the snake_case key whose camelCase equivalent already exists in the source object', () => {
      // foo_bar → fooBar, but fooBar already exists → skip foo_bar
      const result = camelizeKeys({ fooBar: 'authoritative', foo_bar: 'passthrough' }, { skipAliases: true });
      expect(result.fooBar).toBe('authoritative');
      expect(result).not.toHaveProperty('foo_bar');
    });

    it('does not skip when skipAliases is false (default)', () => {
      // Without skipAliases, foo_bar overwrites fooBar
      const result = camelizeKeys({ fooBar: 'original', foo_bar: 'override' });
      expect(result.fooBar).toBe('override');
    });

    it('does not skip a snake_case key when no camelCase alias exists', () => {
      const result = camelizeKeys({ no_alias: 42 }, { skipAliases: true });
      expect(result.noAlias).toBe(42);
    });

    it('defaults to skipAliases: false when options are omitted', () => {
      const result = camelizeKeys({ fooBar: 1, foo_bar: 2 });
      expect(result.fooBar).toBe(2);
    });
  });
});
