import { describe, it, expect } from 'vitest';
import { isInternalPath } from './isInternalPath';

const ORIGIN = 'https://app.example.com';

describe('isInternalPath', () => {
  describe('accepts', () => {
    it.each([
      ['a simple absolute path', '/foo'],
      ['a path with a query string', '/foo?bar=1'],
      ['a path with a fragment', '/foo#frag'],
      ['the root', '/'],
      ['a path with a trailing slash', '/foo/'],
      ['a deep nested path', '/a/b/c/d'],
      ['a path with percent-encoded segments', '/users/%20with%20space'],
      ['a path with a dot segment', '/.'],
      ['a path with dot-dot inside it', '/foo/..%2F..'],
    ])('%s (%s)', (_label, input) => {
      expect(isInternalPath(input, ORIGIN)).toBe(true);
    });
  });

  describe('rejects', () => {
    it.each([
      ['empty string', ''],
      ['undefined', undefined],
      ['null', null],
      ['a number', 42],
      ['an object', {}],
      // Protocol-relative — URL parser treats `//evil.com` as a network-path
      // reference whose origin is `https://evil.com`, which fails the
      // same-origin check.
      ['a protocol-relative URL pointing offsite', '//evil.com'],
      ['a protocol-relative URL with a path', '//evil.com/foo'],
      // Backslash variant some legacy code mistakenly accepts.
      ['a backslash-prefixed offsite URL', '\\\\evil.com'],
      ['a percent-encoded backslash-prefixed URL', '%5C%5Cevil.com'],
      ['a javascript: scheme', 'javascript:alert(1)'],
      ['a data: scheme', 'data:text/html,<script>alert(1)</script>'],
      ['an explicit offsite https URL', 'https://evil.com'],
      ['an http URL pointing offsite', 'http://evil.com/foo'],
      ['a same-host but different-scheme URL', 'http://app.example.com/foo'],
      // Bare paths without a leading `/` resolve relative to the origin's
      // root but produce a pathname that doesn't begin with `/foo` cleanly
      // (the parser normalizes them). The safer behaviour is to reject.
      ['a relative path with no leading slash', 'foo'],
    ])('%s (%j)', (_label, input) => {
      expect(isInternalPath(input, ORIGIN)).toBe(false);
    });
  });

  it('defaults to window.location.origin when origin is omitted', () => {
    // jsdom sets window.location to "http://localhost:3000" by default.
    // A path-only string should accept against whatever origin the runtime
    // exposes, since we resolve against it.
    expect(isInternalPath('/foo')).toBe(true);
  });
});
