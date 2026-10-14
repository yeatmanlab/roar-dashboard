import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskLauncher } from './index';
import { Logger } from './utils';
import { getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';

/**
 * Pins the split logger timing introduced with the SDK handover: installed in the constructor
 * when the host keeps ownership of SDK setup, deferred to `run()` when it hands a context over
 * (because `capture()` snapshots `gameParams`, which are not resolved until then).
 *
 * `init()` is stubbed to reject so `run()` stops immediately after the logger block; the rest
 * of `run()` drives jsPsych and belongs to the Cypress suites.
 */
vi.mock('./styles/index.scss', () => ({}));
vi.mock('./tasks/taskConfig', () => ({ default: {} }));
vi.mock('./sdk/levante-firekit-facade.js', () => ({ wireScoreAdapter: vi.fn() }));
vi.mock('./sentry.js', () => ({ initSentry: vi.fn() }));
vi.mock('./taskStore', () => ({ setTaskStore: vi.fn(), taskStore: vi.fn(() => ({})) }));
vi.mock('./tasks/shared/helpers/getBucketName', () => ({ getBucketName: vi.fn() }));
vi.mock('./tasks/shared/helpers/constants', () => ({ TASK_BUCKET_NAMES_ORIGINAL: {} }));
vi.mock('./tasks/shared/helpers', () => ({
  isTaskFinished: vi.fn(),
  getMediaAssets: vi.fn(),
  dashToCamelCase: vi.fn(),
  showLevanteLogoLoading: vi.fn(),
  hideLevanteLogoLoading: vi.fn(),
  combineMediaAssets: vi.fn(),
  getAssetsPerTask: vi.fn(),
  filterMedia: vi.fn(),
  getRoarMediaAssets: vi.fn(),
  getRoarTranslations: vi.fn(),
}));
vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  startRun: vi.fn(),
  initFirekitCompat: vi.fn(),
  getVariantById: vi.fn(),
}));

// Shaped to satisfy CommandContext: `AssessmentSdkContext` derives from `initFirekitCompat`'s
// real signature, which vi.mock does not change for the type checker.
const CTX = {
  baseUrl: 'http://localhost:4000',
  auth: { getToken: async () => 'test-token' },
  participant: { participantId: 'participant-uuid' },
};
const TASK_INFO = { variantId: 'variant-uuid', taskVersion: '1.0', isAnonymous: false };
const SDK_CONTEXT = { ctx: CTX, taskInfo: TASK_INFO };
const RESOLVED_PARAMS = { taskName: 'egma-math', language: 'es' };

/**
 * Clears the logger singleton between tests.
 *
 * `Logger.instance` is a `private static` with no reset, and `setInstance` throws once it is
 * populated — so without this, the first test to install one makes every later test fail.
 * `private` is erased at runtime, so this reaches it directly rather than adding a
 * test-only method to production code.
 */
function resetLogger() {
  (Logger as unknown as { instance?: Logger }).instance = undefined;
}

/** Runs the task far enough to pass the logger block, then stops. */
async function runToLoggerBlock(task: TaskLauncher) {
  (task as unknown as { init: () => Promise<never> }).init = vi.fn().mockRejectedValue(new Error('stop after logger'));
  await expect(task.run()).rejects.toThrow('stop after logger');
}

describe('TaskLauncher logger timing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLogger();
    vi.mocked(getVariantById).mockResolvedValue({ variantParams: RESOLVED_PARAMS, taskId: 'egma-math' });
  });

  describe('without a handed-over context (the unmigrated host path)', () => {
    it('installs the logger during construction, before run()', () => {
      new TaskLauncher({ taskName: 'egma-math' }, {}, false);

      // The regression this guards: anything reaching getInstance() before run() — a host
      // calling init() directly — would otherwise find the logger unset.
      expect(() => Logger.getInstance()).not.toThrow();
    });

    it('does not install it a second time when run() is called', async () => {
      const task = new TaskLauncher({ taskName: 'egma-math' }, {}, false);

      await runToLoggerBlock(task);

      // Reaching the stubbed init at all proves `setInstance` did not fire a second time —
      // it throws when the instance is already populated — and the logger is still usable.
      expect(() => Logger.getInstance()).not.toThrow();
    });
  });

  describe('with a handed-over context', () => {
    it('defers installation until run() has resolved the variant', async () => {
      const task = new TaskLauncher({}, {}, false, undefined, SDK_CONTEXT);

      expect(() => Logger.getInstance()).toThrow('Logger instance not set');

      await runToLoggerBlock(task);

      expect(() => Logger.getInstance()).not.toThrow();
    });

    it('snapshots the resolved variant params, not the empty ones passed in', async () => {
      const task = new TaskLauncher({}, {}, false, undefined, SDK_CONTEXT);
      await runToLoggerBlock(task);

      // The whole reason for deferring: installing at construction would have pinned `{}`
      // for every event captured during the run.
      const captured: Record<string, unknown>[] = [];
      const instance = Logger.getInstance() as unknown as { levanteLogger: unknown };
      instance.levanteLogger = { capture: (_n: string, p: Record<string, unknown>) => captured.push(p) };

      Logger.getInstance().capture('probe');

      expect(captured[0]?.gameParams).toEqual(RESOLVED_PARAMS);
    });

    it('throws from setInstance if the same instance is run twice', async () => {
      const task = new TaskLauncher({}, {}, false, undefined, SDK_CONTEXT);
      await runToLoggerBlock(task);

      // Documents the constraint rather than endorsing it: the logger is a process-wide
      // singleton with no reset, so a second run() in the same page cannot reinstall it.
      await expect(task.run()).rejects.toThrow('Logger instance already set');
    });
  });
});
