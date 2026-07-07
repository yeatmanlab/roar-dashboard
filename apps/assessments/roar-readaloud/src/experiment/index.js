import store from 'store2';
import { initConfig } from './config/config';
import { startRun, finishRun } from '@roar-platform/assessment-sdk/compat/firekit';
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
  constructor(gameParams, userParams, session = {}) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.assessmentPid = session.assessmentPid ?? '';
    this.assessmentUid = session.assessmentUid ?? '';
    this.displayElement = session.displayElement ?? null;
    this.jsPsych = null;
  }

  async init() {
    initSentry();
  }

  async run() {
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

    await finishRun();
  }
}

export default ReadAloudTask;
