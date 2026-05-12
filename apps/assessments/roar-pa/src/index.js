/* eslint-disable import/extensions */
import { initConfig } from './experiment/config/config';
import { buildExperiment } from './experiment/experiment';
import './experiment/styles/roar.css';
import { waitFor } from './experiment/experimentHelpers';
import { initSentry } from './sentry';

class RoarPA {
  constructor(firekit, gameParams, userParams, displayElement) {
    // TODO: Add validation of params so that if any are missing, we throw an error
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.firekit = firekit;
    this.displayElement = displayElement;
    this.jsPsych = null;
  }

  async init() {
    initSentry();
    await this.firekit.startRun();
    const config = await initConfig(this.firekit, this.gameParams, this.userParams, this.displayElement);
    return buildExperiment(config);
  }

  async run() {
    const { jsPsych, timeline } = await this.init();
    this.jsPsych = jsPsych;
    this.jsPsych.run(timeline);

    await waitFor(() => this.firekit.run.completed === true);
  }

  async abort() {
    this.firekit.abortRun();
    document.querySelectorAll('audio').forEach((el) => el.pause());
    if (this.jsPsych) {
      this.jsPsych.endExperiment();
    }
  }
}

export default RoarPA;
