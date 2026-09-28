import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PG_PORT, resolvePgPort, stackPorts } from './context.mjs';
import { hasYesFlag } from './help.mjs';

describe('resolvePgPort', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('ASSESSMENT_PG_PORT', '');
  });

  it('prefers an explicit env var over everything', () => {
    vi.stubEnv('ASSESSMENT_PG_PORT', '5544');
    const captureFn = vi.fn();
    expect(resolvePgPort(captureFn)).toBe('5544');
    expect(captureFn).not.toHaveBeenCalled();
  });

  it('derives the port from a running assessment-db container', () => {
    const captureFn = vi.fn().mockReturnValue({ ok: true, stdout: '0.0.0.0:5544\n[::]:5544' });
    expect(resolvePgPort(captureFn)).toBe('5544');
  });

  it('falls back to the default when no container is running', () => {
    const captureFn = vi.fn().mockReturnValue({ ok: false, stdout: '' });
    expect(resolvePgPort(captureFn)).toBe(DEFAULT_PG_PORT);
  });
});

describe('stackPorts', () => {
  it('lists every host port the stack binds, Postgres first', () => {
    expect(stackPorts('5544')).toEqual(['5544', '9099', '9199', '9000', '4000']);
  });
});

describe('hasYesFlag', () => {
  it.each([
    [['-y'], true],
    [['--yes'], true],
    [['--force'], true],
    [['--refresh-params'], false],
    [[], false],
  ])('%j -> %s', (args, expected) => {
    expect(hasYesFlag(args)).toBe(expected);
  });
});
