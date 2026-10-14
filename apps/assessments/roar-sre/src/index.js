import store from 'store2';
import { startRun, abortRun, initFirekitCompat, getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';
import { wireScoreAdapter } from './sdk/sre-firekit-facade';
import { initConfig } from './experiment/config/config';
import { buildExperiment } from './experiment/experiment';
import './experiment/styles/roar.scss';
import { initSentry } from './sentry';

class RoarSRE {
  /**
   * @param {object} gameParams - Variant parameters. Ignored in favour of the variant's own
   *   parameters when `sdkContext` is supplied — pass `{}` in that case.
   * @param {object} userParams - Participant/session parameters, forwarded as run metadata.
   * @param {*} [displayElement] - Target the task renders into.
   * @param {boolean} [useParameterValidation] - Whether to validate variant parameters.
   * @param {{ ctx: object, taskInfo: object }} [sdkContext] - Host-supplied SDK wiring. When
   *   present this class owns SDK initialization and variant resolution. When absent the host
   *   must call `initFirekitCompat` itself and pass resolved variant parameters as `gameParams`
   *   — the pre-#2016 contract, still used by the dashboard until it migrates.
   */
  constructor(gameParams, userParams, displayElement, useParameterValidation, sdkContext) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.displayElement = displayElement;
    this.useParameterValidation = useParameterValidation;
    this.sdkContext = sdkContext;
    this.jsPsych = null;

    // `initFirekitCompat` is synchronous, so initializing here rather than in `run()` keeps the
    // facade ready before any other method can touch it. Skipped when the host retains
    // ownership of SDK setup.
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
    const computedScoreCallback = wireScoreAdapter();
    await startRun(this.userParams ?? {});
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement, this.useParameterValidation);
    store.session.set('config', config);
    return buildExperiment(config, computedScoreCallback);
  }

  async run() {
    await this._resolveGameParams();
    const { jsPsych, timeline } = await this.init();
    this.jsPsych = jsPsych;
    await this.jsPsych.run(timeline);
  }

  async abort() {
    abortRun().catch((err) => console.warn('[roar-sre] abortRun failed:', err));
    document.querySelectorAll('audio').forEach((el) => el.pause());
    if (this.jsPsych) {
      this.jsPsych.endExperiment();
    }
  }
}

export default RoarSRE;
