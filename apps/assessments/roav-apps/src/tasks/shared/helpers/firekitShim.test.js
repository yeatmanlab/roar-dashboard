import { vi, describe, test, expect, beforeEach } from 'vitest';

// The shim delegates to these SDK compat functions; capture them so we can assert delegation
// and, critically, that finishRun is only forwarded once.
const sdk = vi.hoisted(() => ({
  writeTrial: vi.fn(),
  finishRun: vi.fn(),
  addInteraction: vi.fn(),
  updateEngagementFlags: vi.fn(),
}));
vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  writeTrial: sdk.writeTrial,
  finishRun: sdk.finishRun,
  addInteraction: sdk.addInteraction,
  updateEngagementFlags: sdk.updateEngagementFlags,
}));

import { createFirekitShim } from './firekitShim';

describe('createFirekitShim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('run.started is true and run.completed is false before finishRun', () => {
    const shim = createFirekitShim();
    expect(shim.run.started).toBe(true);
    expect(shim.run.completed).toBe(false);
  });

  test('finishRun flips run.completed and forwards metadata to the SDK', async () => {
    const shim = createFirekitShim();
    await shim.finishRun({ foo: 'bar' });

    expect(shim.run.completed).toBe(true);
    expect(sdk.finishRun).toHaveBeenCalledTimes(1);
    expect(sdk.finishRun).toHaveBeenCalledWith({ foo: 'bar' });
  });

  test('finishRun is idempotent — a second call does not re-invoke the SDK', async () => {
    const shim = createFirekitShim();
    await shim.finishRun();
    await shim.finishRun();

    expect(sdk.finishRun).toHaveBeenCalledTimes(1);
  });

  test('each shim owns its run-completed state independently', async () => {
    const first = createFirekitShim();
    const second = createFirekitShim();

    await first.finishRun();

    expect(first.run.completed).toBe(true);
    expect(second.run.completed).toBe(false);
  });

  test('updateUser and updateTaskParams are no-ops that never reach the SDK', async () => {
    const shim = createFirekitShim();

    await expect(shim.updateUser({ assessmentPid: 'p1', grade: '3' })).resolves.toBeUndefined();
    await expect(shim.updateTaskParams({ corpusName: 'corpus-def' })).resolves.toBeUndefined();

    expect(sdk.writeTrial).not.toHaveBeenCalled();
    expect(sdk.finishRun).not.toHaveBeenCalled();
  });

  test('writeTrial, addInteraction, and updateEngagementFlags delegate straight to the SDK', () => {
    const shim = createFirekitShim();
    expect(shim.writeTrial).toBe(sdk.writeTrial);
    expect(shim.addInteraction).toBe(sdk.addInteraction);
    expect(shim.updateEngagementFlags).toBe(sdk.updateEngagementFlags);
  });
});
