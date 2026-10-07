import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PG_PORT, resolvePgPort, stackPorts, validAssessmentName } from './context.mjs';
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

  it('falls back to the default when the lookup succeeds with empty output', () => {
    const captureFn = vi.fn().mockReturnValue({ ok: true, stdout: '' });
    expect(resolvePgPort(captureFn)).toBe(DEFAULT_PG_PORT);
  });

  it('parses the port from an IPv6-first binding', () => {
    const captureFn = vi.fn().mockReturnValue({ ok: true, stdout: '[::]:5544\n0.0.0.0:5544' });
    expect(resolvePgPort(captureFn)).toBe('5544');
  });

  it('parses the port from a loopback binding', () => {
    const captureFn = vi.fn().mockReturnValue({ ok: true, stdout: '127.0.0.1:5544' });
    expect(resolvePgPort(captureFn)).toBe('5544');
  });
});

describe('stackPorts', () => {
  it('lists every host port the stack binds, Postgres first', () => {
    expect(stackPorts('5544')).toEqual(['5544', '9097', '9197', '9002', '4002']);
  });
});

describe('validAssessmentName', () => {
  it.each([
    ['roar-swr', true],
    ['roav-ran', true],
    ['roar-multichoice', true],
    ['Roar-SWR', false],
    ['roar swr', false],
    ['roar-swr copy', false],
    ['..', false],
    ['../evil', false],
    ['roar-swr; rm -rf /', false],
    ['$(whoami)', false],
    ['', false],
  ])('%j -> %s', (name, expected) => {
    expect(validAssessmentName(name)).toBe(expected);
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
