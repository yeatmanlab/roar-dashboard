/*
Defines the main task class.
1. Sets the input variables
2. Starts the ROAR run via the assessment-sdk
3. Gets task variables,loads corpus (csv files with questions), builds timeline, initializes jspsych and runs timeline.
4. Imports css styles.
*/

import store from 'store2'; //cross browser local storage
import { camelize, generateAssetObject, createPreloadTrials } from '@bdelab/roar-utils';
import './styles/game.scss'; //getting all the css styles
import { initSentry } from './sentry';
import taskConfig from './tasks/taskConfig';
import { checkAudio, isTaskComplete, isTaskFinished } from './tasks/shared/helpers';
import i18next from 'i18next';
import { startRun, abortRun, initFirekitCompat, getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';
import { wireScoreAdapter } from './sdk/roam-firekit-facade';

export let mediaAssets;
export let preloadTrials;
export class TaskLauncher {
  /**
   * @param {object} gameParams - Variant parameters. Ignored in favour of the variant's own
   *   parameters when `sdkContext` is supplied — pass `{}` in that case.
   * @param {object} userParams - Participant/session parameters, forwarded as run metadata.
   * @param {boolean} [isDev] - Dev-mode flag.
   * @param {*} [displayElement] - Target the task renders into.
   * @param {{ ctx: object, taskInfo: object }} [sdkContext] - Host-supplied SDK wiring. When
   *   present this class owns SDK initialization and variant resolution. When absent the host
   *   must call `initFirekitCompat` itself and pass resolved variant parameters as `gameParams`
   *   — the pre-#2016 contract, still used by the dashboard until it migrates.
   */
  constructor(gameParams, userParams, isDev = false, displayElement, sdkContext) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.isDev = isDev;
    this.displayElement = displayElement;
    this.sdkContext = sdkContext;

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
    //Start the ROAR run. Push the task and run info to the backend.
    //Call this method before starting the jsPsych experiment.
    initSentry();
    wireScoreAdapter();
    await startRun(this.userParams);

    const { taskName } = this.gameParams;

    const { initConfig, loadCorpus, buildTaskTimeline, bucketURI, assets } = taskConfig[camelize(taskName)];

    //cleans the parameters and sets other variables (time, number of trials, corpus name)
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement);
    //store this data in the browser
    store.session.set('config', config);

    //initStore();

    await loadCorpus(taskName, assets);
    mediaAssets = generateAssetObject(assets, bucketURI, i18next.language);
    preloadTrials = createPreloadTrials(assets, bucketURI, i18next.language).default;
    preloadTrials.message = i18next.t('loading');

    checkAudio(config, mediaAssets);
    //building timeline
    return buildTaskTimeline(config);
  }

  async run() {
    await this._resolveGameParams();
    const { jsPsych, timeline } = await this.init();
    jsPsych.opts.show_progress_bar = this.gameParams.taskName === 'roam-alpaca' ? false : true;
    jsPsych.run(timeline);
    await isTaskFinished(() => isTaskComplete());
  }

  abort() {
    abortRun().catch((err) => console.warn('[roam-apps] abortRun failed:', err));
  }
}

export default TaskLauncher;
