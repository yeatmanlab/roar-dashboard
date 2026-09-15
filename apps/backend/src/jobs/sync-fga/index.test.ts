import { beforeEach, describe, it, expect, vi } from 'vitest';

// Hoisted so the vi.mock factory below can reference it.
const { mockRun } = vi.hoisted(() => ({
  mockRun: vi.fn<(argv: readonly string[]) => Promise<number>>(),
}));

vi.mock('./sync-fga.job', () => ({ run: mockRun }));

describe('sync-fga index entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unconditionally executes the job and exits with its code', async () => {
    mockRun.mockResolvedValue(0);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await import('./index');

    // The entry runs via a promise chain — wait for the exit call it settles into.
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
    expect(mockRun).toHaveBeenCalledWith(process.argv);

    exitSpy.mockRestore();
  });
});
