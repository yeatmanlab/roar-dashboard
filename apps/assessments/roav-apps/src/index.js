/*
Defines the main task class.
1. Sets the input variables
2. Starts the ROAR firekit run function
3. Gets task variables,loads corpus (csv files with questions), builds timeline, initializes jspsych and runs timeline.
4. Imports css styles.
*/

import { camelize } from '@bdelab/roar-utils';
import { startRun, initFirekitCompat, getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';
import { isTaskFinished } from './tasks/shared/helpers/isTaskFinished';
import './styles/styles.scss'; // getting all the css styles
import { initSentry } from './sentry';
import { wireScoreAdapter } from './sdk/roav-apps-firekit-facade.js';
import { buildRunMetadata } from './tasks/shared/helpers/runMetadata';
import { initPreloadTrials } from './tasks/shared/trials/preloadTrials';
import { initTrialSaving } from './tasks/shared/helpers/initTrialSaving';
import taskConfig from './tasks/taskConfig';
import { initMediaAssets } from './tasks/shared/helpers/mediaAssets';
import { sessionSet } from './tasks/shared/helpers/sessionHelpers';
import { SESSION_KEYS as SK } from './tasks/shared/helpers/sessionKeys';
import { installAssessmentLifecycleGuards } from './tasks/shared/helpers/audioHelpers';

export class TaskLauncher {
  /**
   * @param {object} gameParams - Variant parameters. Ignored in favour of the variant's own
   *   parameters when `sdkContext` is supplied — pass `{}` in that case.
   * @param {object} userParams - Participant/session parameters, forwarded as run metadata.
   * @param {*} [displayElement] - Target the task renders into.
   * @param {{ ctx: object, taskInfo: object }} [sdkContext] - Host-supplied SDK wiring. When
   *   present this class owns SDK initialization and variant resolution. When absent the host
   *   must call `initFirekitCompat` itself and pass resolved variant parameters as `gameParams`
   *   — the pre-#2016 contract, still used by the dashboard until it migrates.
   */
  constructor(gameParams, userParams, displayElement, sdkContext) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.displayElement = displayElement;
    this.sdkContext = sdkContext;

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
    installAssessmentLifecycleGuards(); // @fix-freeze-audio
    initSentry();
    wireScoreAdapter();
    // Operator/participant-supplied context (PID + demographics from the launch URL) is
    // persisted to run metadata — never to the user record. Absent/empty URL params are
    // omitted so metadata only carries what was actually provided.
    await startRun(buildRunMetadata(this.userParams));

    const { taskName } = this.gameParams;

    const { initConfig, initStore, loadCorpus, buildTimelineTask, bucketURI, assets } = taskConfig[camelize(taskName)];

    const config = await initConfig(this.gameParams, this.userParams);
    this.config = config;
    sessionSet(SK.CONFIG, config);

    initStore();

    await loadCorpus(taskName, assets, bucketURI);

    initMediaAssets(assets, bucketURI);

    initPreloadTrials(assets, bucketURI);

    initTrialSaving(config);
    return buildTimelineTask(config);
  }

  async run() {
    await this._resolveGameParams();
    const { jsPsych, timeline } = await this.init();
    jsPsych.run(timeline);
    await isTaskFinished(() => this.config.firekit.run.completed === true);
  }
}

export default TaskLauncher;
