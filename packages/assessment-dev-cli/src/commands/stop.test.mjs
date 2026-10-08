import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compose } from '../docker.mjs';
import { capture } from '../proc.mjs';
import { TEARDOWN_WARNING } from '../help.mjs';
import { confirmTeardown, stop } from './stop.mjs';

vi.mock('../docker.mjs');
vi.mock('../proc.mjs');
vi.mock('../context.mjs', () => ({
  resolvePgPort: vi.fn(() => '5433'),
}));

const DOWN_KEEP = ['down', '--remove-orphans', '--timeout', '0'];
const DOWN_DELETE = ['down', '-v', '--remove-orphans', '--timeout', '0'];

function makeUi({ confirmValue = true } = {}) {
  return {
    step: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    confirm: vi.fn(async () => confirmValue),
  };
}

/** True when some capture() call ran `docker volume rm` naming the volume. */
function volumeRemoved(name) {
  return vi
    .mocked(capture)
    .mock.calls.some(([command]) => command[1] === 'volume' && command[2] === 'rm' && command.includes(name));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(compose).mockReturnValue({ ok: true });
  vi.mocked(capture).mockReturnValue({ ok: true, stdout: '' });
});

describe('stop', () => {
  it('-y deletes without prompting: compose down -v plus the legacy volumes', async () => {
    const ui = makeUi();
    await stop(ui, ['-y']);
    expect(ui.confirm).not.toHaveBeenCalled();
    expect(compose).toHaveBeenCalledWith(DOWN_DELETE, '5433', { quiet: true });
    expect(volumeRemoved('roar-assessment_pgdata')).toBe(true);
    expect(ui.success).toHaveBeenCalledWith('Assessment environment stopped and local data deleted.');
  });

  it('--keep-data keeps without prompting: no -v, no volume removal', async () => {
    const ui = makeUi();
    await stop(ui, ['--keep-data']);
    expect(ui.confirm).not.toHaveBeenCalled();
    expect(compose).toHaveBeenCalledWith(DOWN_KEEP, '5433', { quiet: true });
    expect(volumeRemoved('roar-assessment_pgdata')).toBe(false);
    expect(ui.success).toHaveBeenCalledWith(expect.stringContaining('the database was kept'));
  });

  it('without flags, asks — defaulting to keep, and keeping on non-TTY', async () => {
    const ui = makeUi({ confirmValue: true });
    await stop(ui, []);
    expect(ui.confirm).toHaveBeenCalledWith(expect.stringContaining('Keep the local database'), {
      nonTtyValue: true,
      initialValue: true,
    });
    expect(compose).toHaveBeenCalledWith(DOWN_KEEP, '5433', { quiet: true });
  });

  it('a declined keep deletes the data', async () => {
    const ui = makeUi({ confirmValue: false });
    await stop(ui, []);
    expect(compose).toHaveBeenCalledWith(DOWN_DELETE, '5433', { quiet: true });
    expect(volumeRemoved('roar-assessment_pgdata')).toBe(true);
  });

  it('falls back to direct termination when compose down fails, still honoring the delete', async () => {
    vi.mocked(compose).mockReturnValue({ ok: false });
    const ui = makeUi();
    await stop(ui, ['-y']);

    expect(ui.warn).toHaveBeenCalledWith(expect.stringContaining('Falling back'));
    const captured = vi.mocked(capture).mock.calls.map(([command]) => command);
    expect(captured.some((command) => command[1] === 'update' && command[2] === '--restart=no')).toBe(true);
    expect(captured.some((command) => command[1] === 'rm' && command[2] === '-f')).toBe(true);
    // The retried compose down may also have failed, so the current data
    // volume must be removed explicitly — the delete contract depends on it.
    expect(volumeRemoved('roar-assessment-postgres-data')).toBe(true);
    expect(ui.success).toHaveBeenCalledWith('Assessment environment stopped and local data deleted.');
    expect(process.exitCode).toBeUndefined();
  });
});

describe('confirmTeardown', () => {
  it('-y skips the warning and the prompt', async () => {
    const ui = makeUi();
    await expect(confirmTeardown(ui, ['-y'])).resolves.toBe(true);
    expect(ui.warn).not.toHaveBeenCalled();
    expect(ui.confirm).not.toHaveBeenCalled();
  });

  it('otherwise warns and asks — proceeding on non-TTY, where restart means a wipe by design', async () => {
    const ui = makeUi({ confirmValue: false });
    await expect(confirmTeardown(ui, [])).resolves.toBe(false);
    expect(ui.warn).toHaveBeenCalledWith(TEARDOWN_WARNING);
    expect(ui.confirm).toHaveBeenCalledWith('Continue?', { nonTtyValue: true });
  });
});
