import store from 'store2';
import { startRun, abortRun } from '@roar-platform/assessment-sdk/compat/firekit';
import { initConfig } from './experiment/config/config';
import { buildExperiment } from './experiment/experiment';
import './experiment/styles/roar.scss';
import { initSentry } from './sentry';

class RoarSRE {
  constructor(gameParams, userParams, displayElement, useParameterValidation) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.displayElement = displayElement;
    this.useParameterValidation = useParameterValidation;
    this.jsPsych = null;
  }

  async init() {
    initSentry();
    await startRun(this.userParams ?? {});
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement, this.useParameterValidation);
    store.session.set('config', config);
    return buildExperiment(config);
  }

  async run() {
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
