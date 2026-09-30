import store from 'store2';
import { initConfig } from './config/config';
import {
  startRun,
  finishRun,
  flushUploads,
  initFirekitCompat,
  getVariantById,
} from '@roar-platform/assessment-sdk/compat/firekit';
import { READALOUD_TEST_CONFIG_URL } from '@roar-platform/assessment-schema/roar-readaloud';
import './styles/task.scss';
import { consentView } from './views/consentView';
import { configureDeviceView } from './views/configureDeviceView';
import { headCalibrationView } from './views/headCalibrationView';
import { calibrateMicrophoneView } from './views/calibrateMicrophoneView.js';

import { menuView } from './views/menuView';
import { TestView } from './views/TestView';
import { storyView } from './views/storyView.js';
import { initSentry } from '../sentry';
// import "./css/game_v4.css";
// import jsPsychFullScreen from "@jspsych/plugin-fullscreen";
// import jsPsychCallFunction from "@jspsych/plugin-call-function";
// import {
//   jsPsych,
//   config,
//   taskInfo,
// } from "./config";
// import { characters, preload_trials } from "./preload";
// import videoTrials from "./videos";
// import { svgName, corpora } from "./corpus";
// import { makeRoarTrial } from "./utils";

class ReadAloudTask {
  /**
   * @param {object} gameParams - Variant parameters. Ignored in favour of the variant's own
   *   parameters when `sdkContext` is supplied — pass `{}` in that case.
   * @param {object} userParams - Participant/session parameters, forwarded as run metadata.
   * @param {{ assessmentPid?: string, assessmentUid?: string, displayElement?: * }} [session]
   * @param {{ ctx: object, taskInfo: object }} [sdkContext] - Host-supplied SDK wiring. When
   *   present this class owns SDK initialization and variant resolution. When absent the host
   *   must call `initFirekitCompat` itself and pass resolved variant parameters as `gameParams`
   *   — the pre-#2016 contract, still used by the dashboard until it migrates.
   */
  constructor(gameParams, userParams, session = {}, sdkContext) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.assessmentPid = session.assessmentPid ?? '';
    this.assessmentUid = session.assessmentUid ?? '';
    this.displayElement = session.displayElement ?? null;
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
  }

  async run() {
    await this._resolveGameParams();

    // Consent view
    if (this.gameParams.consent) {
      await consentView();
    }

    await startRun(this.userParams ?? {});
    const config = await initConfig(this.gameParams, this.userParams, {
      assessmentPid: this.assessmentPid,
      assessmentUid: this.assessmentUid,
      displayElement: this.displayElement,
    });

    store.session.set('config', config);

    await configureDeviceView(config);
    await calibrateMicrophoneView();
    if (config.story) {
      await storyView('Introduction', config);
    }
    if (this.gameParams.bViewingDistancePage) {
      await headCalibrationView(config);
    }

    let testComplete = false;
    if (config.story) {
      await storyView('Calibration', config);
    }

    do {
      await menuView(READALOUD_TEST_CONFIG_URL(this.gameParams.testConfigFile));
      if (config.story) {
        await storyView('Practice', config);
      }
      await TestView('Practice', config);

      if (config.story) {
        await storyView('Test', config);
      }
      await TestView('Test', config);
      // await jsPsych.run(testTimeline);
      testComplete = sessionStorage.getItem('testComplete') === 'true';
    } while (!testComplete);

    if (config.story) {
      await storyView('Ending', config);
    }

    // Drain the fire-and-forget recording uploads before marking the run complete, so the
    // final phase's recordings aren't dropped when the page navigates away after finishRun().
    await flushUploads();
    await finishRun();
  }
}

export default ReadAloudTask;
