/* eslint-disable import/extensions */
import store from 'store2';
import { initConfig } from './experiment/config/config';
import { buildExperiment } from './experiment/experiment';
import './experiment/styles/game.scss';
import { waitFor } from './experiment/helperFunctions';
import { initSentry } from './sentry';

class RoarSWR {
  constructor(firekit, gameParams, userParams, displayElement, useParameterValidation) {
    // TODO: Add validation of params so that if any are missing, we throw an error
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.firekit = firekit;
    this.displayElement = displayElement;
    this.useParameterValidation = useParameterValidation;
    this.jsPsych = null;
  }

  async init() {
    initSentry();
    await this.firekit.startRun();
    const config = await initConfig(
      this.firekit,
      this.gameParams,
      this.userParams,
      this.displayElement,
      this.useParameterValidation,
    );

    store.session.set('config', config);
    return buildExperiment(this.firekit, config);
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

export default RoarSWR;
