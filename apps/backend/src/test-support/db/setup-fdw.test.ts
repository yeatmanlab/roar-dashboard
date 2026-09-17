/**
 * Unit tests for the pure helpers in setup-fdw.ts.
 *
 * These cover the SQL-literal quoting and URL-parsing branches without
 * hitting Postgres — the end-to-end SQL execution path is exercised by the
 * integration test setup that calls `setupFdwForTests()` for real.
 */
import { describe, it, expect } from 'vitest';
import { assertSameHostPort, literal, parseConnectionUrl } from './setup-fdw';

describe('literal', () => {
  it('wraps an empty string in single quotes', () => {
    expect(literal('')).toBe("''");
  });

  it('wraps a value with no quotes in single quotes', () => {
    expect(literal('postgres')).toBe("'postgres'");
  });

  it('doubles a single quote inside the value', () => {
    expect(literal("O'Brien")).toBe("'O''Brien'");
  });

  it('doubles every single quote in a value with multiple quotes', () => {
    expect(literal("it's 'quoted' twice")).toBe("'it''s ''quoted'' twice'");
  });

  it('passes through other characters without escaping', () => {
    // Postgres `standard_conforming_strings = on` does not interpret backslashes,
    // so they need no escaping in single-quoted literals.
    expect(literal('back\\slash')).toBe("'back\\slash'");
  });
});

describe('parseConnectionUrl', () => {
  it('extracts host, port, user, password, and database from a fully-specified URL', () => {
    const parsed = parseConnectionUrl('postgres://alice:secret@db.local:6543/core_test');

    expect(parsed).toEqual({
      host: 'db.local',
      port: '6543',
      user: 'alice',
      password: 'secret',
      database: 'core_test',
    });
  });

  it('falls back to "postgres" when the URL has no username', () => {
    const parsed = parseConnectionUrl('postgres://db.local:5432/core_test');

    expect(parsed.user).toBe('postgres');
  });

  it('falls back to empty password when the URL has no password', () => {
    const parsed = parseConnectionUrl('postgres://alice@db.local:5432/core_test');

    expect(parsed.password).toBe('');
  });

  it('defaults port to 5432 when the URL omits it', () => {
    const parsed = parseConnectionUrl('postgres://alice:secret@db.local/core_test');

    expect(parsed.port).toBe('5432');
  });

  it('strips the leading slash from the database name', () => {
    const parsed = parseConnectionUrl('postgres://alice:secret@db.local:5432/roar_core_test');

    expect(parsed.database).toBe('roar_core_test');
  });

  it('decodes percent-encoded username and password', () => {
    const parsed = parseConnectionUrl('postgres://us%40er:p%40ss@db.local:5432/core_test');

    expect(parsed.user).toBe('us@er');
    expect(parsed.password).toBe('p@ss');
  });
});

describe('assertSameHostPort', () => {
  it('does not throw when host and port match', () => {
    expect(() =>
      assertSameHostPort({ host: 'db.local', port: '5432' }, { host: 'db.local', port: '5432' }),
    ).not.toThrow();
  });

  it('throws when hosts differ', () => {
    expect(() => assertSameHostPort({ host: 'a.local', port: '5432' }, { host: 'b.local', port: '5432' })).toThrow(
      /CORE_DATABASE_URL and ASSESSMENT_DATABASE_URL must share the same host:port/,
    );
  });

  it('throws when ports differ', () => {
    expect(() => assertSameHostPort({ host: 'db.local', port: '5432' }, { host: 'db.local', port: '6543' })).toThrow(
      /Got core=db.local:5432, assessment=db.local:6543/,
    );
  });
});
