import { describe, it, expect } from 'vitest';
import { escapeLikePattern } from './escape-like-pattern.util';

describe('escapeLikePattern', () => {
  describe('happy path', () => {
    it('returns plain strings unchanged', () => {
      expect(escapeLikePattern('hello')).toBe('hello');
    });

    it('returns an empty string unchanged', () => {
      expect(escapeLikePattern('')).toBe('');
    });
  });

  describe('LIKE metacharacter escaping', () => {
    it('escapes % so it is treated as a literal percent sign', () => {
      expect(escapeLikePattern('100%')).toBe('100\\%');
    });

    it('escapes _ so it is treated as a literal underscore', () => {
      expect(escapeLikePattern('user_name')).toBe('user\\_name');
    });

    it('escapes multiple % characters', () => {
      expect(escapeLikePattern('%foo%')).toBe('\\%foo\\%');
    });

    it('escapes multiple _ characters', () => {
      expect(escapeLikePattern('a_b_c')).toBe('a\\_b\\_c');
    });

    it('escapes both % and _ in the same string', () => {
      expect(escapeLikePattern('50%_off')).toBe('50\\%\\_off');
    });
  });

  describe('backslash escaping', () => {
    it('escapes a backslash so it is treated as a literal backslash', () => {
      expect(escapeLikePattern('C:\\Users')).toBe('C:\\\\Users');
    });

    it('escapes backslash before % to avoid producing an accidental escape sequence', () => {
      // Input:  \%   — could be misread as "escaped percent" if backslash isn't doubled first
      // Output: \\%  — backslash is doubled, then % is escaped → \\\\%  becomes  \\%
      // i.e. the DB sees a literal backslash followed by a literal percent
      expect(escapeLikePattern('\\%')).toBe('\\\\\\%');
    });

    it('escapes backslash before _ correctly', () => {
      expect(escapeLikePattern('\\_')).toBe('\\\\\\_');
    });
  });

  describe('edge cases to be aware of', () => {
    it('handles strings that are only metacharacters', () => {
      expect(escapeLikePattern('%_%')).toBe('\\%\\_\\%');
    });

    it('handles repeated backslashes', () => {
      expect(escapeLikePattern('\\\\')).toBe('\\\\\\\\');
    });

    it('does not alter unicode or non-ASCII characters', () => {
      expect(escapeLikePattern('café_50%')).toBe('café\\_50\\%');
    });

    it('does not escape characters that have no LIKE special meaning', () => {
      // Parentheses, brackets, dots, etc. are not LIKE metacharacters in Postgres
      expect(escapeLikePattern('(foo.bar)[baz]')).toBe('(foo.bar)[baz]');
    });

    it('handles a string that is a single backslash', () => {
      expect(escapeLikePattern('\\')).toBe('\\\\');
    });
  });
});
