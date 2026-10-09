import store from 'store2';
import i18next from 'i18next';
import './i18n.js';
import './styles/index.js';
import { camelize } from '@bdelab/roar-utils';
import {
  startRun,
  flushUploads,
  initFirekitCompat,
  getVariantById,
} from '@roar-platform/assessment-sdk/compat/firekit';

import taskConfig from './tasks/taskConfig';
import { buildRunMetadata } from './tasks/shared/helpers/runMetadata';

import { consentView, preloadView } from './tasks/shared/views';

// Centralize window assignments so all views can access these globals
window.store = store;
window.i18next = i18next;

class TaskLauncher {
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

  async init() {}

  async run() {
    await this._resolveGameParams();
    // Consent view
    if (this.gameParams.consent) {
      await consentView();
    }

    // Operator/participant context (PID + demographics from the launch URL) is persisted to
    // run metadata — never to the user record. Empty params are omitted by buildRunMetadata.
    await startRun(buildRunMetadata(this.userParams));

    const { initConfig, buildTaskViews, audioMapping, imageAssets } = taskConfig[camelize(this.gameParams.taskName)];

    //cleans the parameters and sets other variables (time, number of trials, corpus name)
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement);
    //store this data in the browser
    store.session.set('config', config);

    //pull language specific audio+text, en is the default if the language assets do not exist
    const audioMappingLang = audioMapping[i18next.language] ?? audioMapping.en ?? {};

    await preloadView(config, audioMappingLang, imageAssets);

    const task = new buildTaskViews(config, audioMappingLang, this.gameParams);
    const result = await task.run();
    if (result === 'aborted') return 'aborted';

    await config.firekit.updateEngagementFlags([], true);
    // Drain any in-flight recording uploads before marking the run complete, so the final
    // recordings aren't dropped on navigation/unload.
    await flushUploads();
    await config.firekit.finishRun();
    return 'success';
  }
}

export default TaskLauncher;
