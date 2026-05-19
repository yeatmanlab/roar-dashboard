 
import { startRun, abortRun } from '@yeatmanlab/assessment-sdk/compat/firekit';
import { initConfig } from './experiment/config/config';
import { buildExperiment } from './experiment/experiment';
import './experiment/styles/roar.css';
import { initSentry } from './sentry';

class RoarPA {
  constructor(gameParams, userParams, displayElement) {
    // TODO: Add validation of params so that if any are missing, we throw an error
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.displayElement = displayElement;
    this.jsPsych = null;
  }

  async init() {
    initSentry();
    await startRun();
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement);
    return buildExperiment(config);
  }

  async run() {
    const { jsPsych, timeline } = await this.init();
    this.jsPsych = jsPsych;
    this.jsPsych.run(timeline);
  }

  async abort() {
    abortRun();
    document.querySelectorAll('audio').forEach((el) => el.pause());
    if (this.jsPsych) {
      this.jsPsych.endExperiment();
    }
  }
}

export default RoarPA;
