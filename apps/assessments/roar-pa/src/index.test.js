import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initFirekitCompat, getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';
import RoarPA from './index';

/**
 * Covers the SDK-handover path that #2016 added to every assessment entry.
 *
 * The constructor block and `_resolveGameParams` are duplicated byte-for-byte across nine
 * entries (levante differs only in its TypeScript annotations), so this pins the shared
 * behaviour the other copies rely on until the helper is extracted in the normalisation PR.
 * `roar-pa` is used because it has the plainest constructor of the set.
 *
 * Only construction and resolution are exercised — `run()` drives jsPsych and belongs to
 * the Cypress suites.
 */
vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  startRun: vi.fn(),
  abortRun: vi.fn(),
  initFirekitCompat: vi.fn(),
  getVariantById: vi.fn(),
}));

vi.mock('./experiment/config/config', () => ({ initConfig: vi.fn() }));
vi.mock('./experiment/experiment', () => ({ buildExperiment: vi.fn() }));
vi.mock('./sentry', () => ({ initSentry: vi.fn() }));
vi.mock('./experiment/styles/roar.css', () => ({}));

const CTX = { baseUrl: 'http://localhost:4000', auth: {}, participant: { participantId: 'participant-uuid' } };
const TASK_INFO = { variantId: 'variant-uuid', taskVersion: '1.0', isAnonymous: false };
const SDK_CONTEXT = { ctx: CTX, taskInfo: TASK_INFO };

describe('RoarPA SDK handover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVariantById).mockResolvedValue({ variantParams: { corpus: 'from-variant' } });
  });

  describe('construction', () => {
    it('initializes the SDK with the host-supplied context', () => {
      new RoarPA({}, {}, undefined, SDK_CONTEXT);

      // Synchronous on purpose: the facade is ready before any method can run.
      expect(initFirekitCompat).toHaveBeenCalledWith(CTX, TASK_INFO);
    });

    it('leaves SDK setup to the host when no context is supplied', () => {
      new RoarPA({ corpus: 'from-host' }, {}, undefined);

      expect(initFirekitCompat).not.toHaveBeenCalled();
    });
  });

  describe('variant resolution', () => {
    it('resolves the variant named by the handed-over taskInfo', async () => {
      const task = new RoarPA({}, {}, undefined, SDK_CONTEXT);

      await task._resolveGameParams();

      expect(getVariantById).toHaveBeenCalledWith(TASK_INFO.variantId);
      expect(task.gameParams).toEqual({ corpus: 'from-variant' });
    });

    it('lets the variant override params the host passed', async () => {
      // The variant is the authority; anything passed in is a fallback for keys it omits.
      const task = new RoarPA({ corpus: 'from-host', task: 'kept' }, {}, undefined, SDK_CONTEXT);

      await task._resolveGameParams();

      expect(task.gameParams).toEqual({ corpus: 'from-variant', task: 'kept' });
    });

    it('is a no-op without a context, leaving the host-passed params alone', async () => {
      const task = new RoarPA({ corpus: 'from-host' }, {}, undefined);

      await task._resolveGameParams();

      expect(getVariantById).not.toHaveBeenCalled();
      expect(task.gameParams).toEqual({ corpus: 'from-host' });
    });

    it('propagates a failed variant lookup rather than running on empty params', async () => {
      vi.mocked(getVariantById).mockRejectedValue(new Error('variant not found'));
      const task = new RoarPA({}, {}, undefined, SDK_CONTEXT);

      await expect(task._resolveGameParams()).rejects.toThrow('variant not found');
    });
  });
});
