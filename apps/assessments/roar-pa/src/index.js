import { startRun, abortRun, initFirekitCompat, getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';
import { initConfig } from './experiment/config/config';
import { buildExperiment } from './experiment/experiment';
import './experiment/styles/roar.css';
import { initSentry } from './sentry';

class RoarPA {
  /**
   * @param {object} gameParams - Variant parameters. Ignored in favour of the variant's own
   *   parameters when `sdkContext` is supplied — pass `{}` in that case.
   * @param {object} userParams - Participant/session parameters, forwarded as run metadata.
   * @param {string} [displayElement] - DOM id jsPsych renders into.
   * @param {{ ctx: object, taskInfo: object }} [sdkContext] - Host-supplied SDK wiring. When
   *   present this class owns SDK initialization and variant resolution. When absent the host
   *   must call `initFirekitCompat` itself and pass resolved variant parameters as `gameParams`
   *   — the pre-#2016 contract, still used by the dashboard until it migrates.
   */
  constructor(gameParams, userParams, displayElement, sdkContext) {
    // TODO: Add validation of params so that if any are missing, we throw an error
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.displayElement = displayElement;
    this.sdkContext = sdkContext;
    this.jsPsych = null;

    // `initFirekitCompat` is synchronous, so initializing here rather than in `run()` keeps the
    // facade ready before any other method can touch it — including for hosts that call `init()`
    // directly. Skipped when the host retains ownership of SDK setup.
    if (sdkContext) {
      initFirekitCompat(sdkContext.ctx, sdkContext.taskInfo);
    }
  }

  /**
   * Resolves the run's variant parameters through the SDK when the host handed over its context.
   *
   * No-op otherwise, so a host that has not migrated keeps supplying `gameParams` itself.
   *
   * @returns {Promise<void>}
   */
  async _resolveGameParams() {
    if (!this.sdkContext) return;

    const { variantParams } = await getVariantById(this.sdkContext.taskInfo.variantId);
    // The variant is the authority on game parameters; anything the host passed is a fallback.
    // See .ai/rules/assessment-integration-pattern.md.
    this.gameParams = { ...this.gameParams, ...variantParams };
  }

  async init() {
    initSentry();
    await startRun(this.userParams ?? {});
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement);
    return buildExperiment(config);
  }

  async run() {
    await this._resolveGameParams();
    const { jsPsych, timeline } = await this.init();
    this.jsPsych = jsPsych;
    // jsPsych.run() resolves after the full timeline completes (including on_finish),
    // which is when finishRun() fires. Awaiting it preserves the completion contract
    // that callers (e.g. TaskPA.vue) depend on: they navigate once this run promise resolves.
    await this.jsPsych.run(timeline);
  }

  async abort() {
    document.querySelectorAll('audio').forEach((el) => el.pause());
    if (this.jsPsych) {
      this.jsPsych.endExperiment();
    }
    // Order so that UI teardown is synchronous; backend abort is best-effort,
    // but log on failure so we know the server's run state may be stale.
    abortRun().catch((err) => {
      console.warn('abortRun failed; backend run state may be stale', err);
    });
  }
}

export default RoarPA;
