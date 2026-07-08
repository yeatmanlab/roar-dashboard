import store from 'store2';
import { initConfig } from './config/config';
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

const isTaskFinished = (conditionFunction) => {
  const poll = (resolve) => {
    if (conditionFunction()) resolve();
    else setTimeout((_) => poll(resolve), 400);
  };

  return new Promise(poll);
};

class ReadAloudTask {
  constructor(firekit, gameParams, userParams, displayElement) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.firekit = firekit;
    this.displayElement = displayElement;
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

    await this.firekit.startRun();
    const config = await initConfig(this.firekit, this.gameParams, this.userParams, this.displayElement);

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
      await menuView(`https://storage.googleapis.com/roav-readaloud/en/shared/${this.gameParams.testConfigFile}.json`);
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

    config.firekit.finishRun();
    await isTaskFinished(() => this.firekit.run.completed === true);
  }
}

export default ReadAloudTask;
