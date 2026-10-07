import { beforeEach, describe, expect, it, vi } from 'vitest';
import { capture } from './proc.mjs';
import { diagnosePortConflict } from './docker.mjs';

vi.mock('./proc.mjs');

/**
 * Routes the three probes diagnosePortConflict issues: `docker ps` (container
 * holding the port), `docker inspect` (its compose project label), and `lsof`
 * (host process). Unlisted commands fail, mirroring a missing tool.
 */
function mockProbes({ container = '', project = '', lsof = { ok: false, stdout: '' } } = {}) {
  vi.mocked(capture).mockImplementation((command) => {
    if (command[0] === 'docker' && command[1] === 'ps') return { ok: true, stdout: container };
    if (command[0] === 'docker' && command[1] === 'inspect') return { ok: true, stdout: project };
    if (command[0] === 'lsof') return lsof;
    return { ok: false, stdout: '' };
  });
}

describe('diagnosePortConflict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('points a stale assessment container at npm run stop', () => {
    mockProbes({ container: 'assessment-db\n', project: 'roar-assessment\n' });
    const lines = diagnosePortConflict('5433', '5433');
    expect(lines[0]).toContain('assessment environment is still partially running (container: assessment-db)');
    expect(lines).toContain('  npm run stop');
  });

  it('names a foreign container and how to stop it', () => {
    mockProbes({ container: 'pgweb\n', project: 'some-other-project\n' });
    const lines = diagnosePortConflict('5433', '5433');
    expect(lines[0]).toBe('A Docker container is holding the port: pgweb');
    expect(lines).toContain('  docker stop pgweb');
  });

  it('names the host process holding the port from lsof output', () => {
    mockProbes({
      lsof: {
        ok: true,
        stdout: 'COMMAND   PID USER   FD   TYPE\npostgres  123  max   7u  IPv4',
      },
    });
    const lines = diagnosePortConflict('9002', '5433');
    expect(lines[0]).toBe('The port is held by another program: postgres (pid 123). Stop that program, then retry.');
  });

  it('degrades to a lookup hint when lsof is unavailable, without Postgres advice on other ports', () => {
    mockProbes();
    const lines = diagnosePortConflict('9002', '5433');
    expect(lines).toEqual(['Find the process with: lsof -i :9002  (or: ss -tlnp | grep 9002)']);
  });

  it('adds the local-PostgreSQL culprits and the port override for the Postgres port', () => {
    mockProbes();
    const lines = diagnosePortConflict('5433', '5433');
    expect(lines[0]).toBe('Find the process with: lsof -i :5433  (or: ss -tlnp | grep 5433)');
    expect(lines.some((line) => line.includes('brew services stop'))).toBe(true);
    expect(lines).toContain('Or pick another port: ASSESSMENT_PG_PORT=<port> npm start');
  });

  it('offers the port override alongside a named holder on the Postgres port, without the culprit list', () => {
    mockProbes({
      lsof: { ok: true, stdout: 'COMMAND   PID USER\npostgres  123  max' },
    });
    const lines = diagnosePortConflict('5433', '5433');
    expect(lines[0]).toContain('postgres (pid 123)');
    expect(lines.some((line) => line.includes('brew services stop'))).toBe(false);
    expect(lines).toContain('Or pick another port: ASSESSMENT_PG_PORT=<port> npm start');
  });
});
