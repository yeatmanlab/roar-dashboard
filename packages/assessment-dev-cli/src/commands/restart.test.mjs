import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { start } from './start.mjs';
import { confirmTeardown, stop } from './stop.mjs';
import { restart } from './restart.mjs';

vi.mock('./start.mjs');
vi.mock('./stop.mjs');

function makeUi() {
  return { outro: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  process.exitCode = undefined;
});

describe('restart', () => {
  it('aborts cleanly on decline — nothing torn down, nothing started, exit 0', async () => {
    vi.mocked(confirmTeardown).mockResolvedValue(false);
    const ui = makeUi();
    await restart(ui, []);
    expect(ui.outro).toHaveBeenCalledWith(expect.stringContaining('Aborted'));
    expect(stop).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('on confirm, tears down without re-prompting and starts', async () => {
    vi.mocked(confirmTeardown).mockResolvedValue(true);
    const ui = makeUi();
    await restart(ui, []);
    expect(stop).toHaveBeenCalledWith(ui, ['--yes']);
    expect(start).toHaveBeenCalledWith(ui);
  });

  it('does not start when the teardown failed', async () => {
    vi.mocked(confirmTeardown).mockResolvedValue(true);
    vi.mocked(stop).mockImplementation(async () => {
      process.exitCode = 1;
    });
    await restart(makeUi(), []);
    expect(start).not.toHaveBeenCalled();
  });
});
