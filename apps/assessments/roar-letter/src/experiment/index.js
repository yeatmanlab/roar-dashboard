/* eslint-disable import/extensions */
import store from 'store2';
import i18next from 'i18next';
import { initConfig } from './config/config';
import { buildExperiment } from './experiment';
import { waitFor } from './helperFunctions';
import './styles/game.scss';
import { initSentry } from '../sentry';
import { loadCorpus } from './config/corpus.js';

class RoarLetter {
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
    store.session.set('config', config);
    await loadCorpus(config);
    return buildExperiment(config);
  }

  async run() {
    const { jsPsych, timeline } = await this.init();
    this.jsPsych = jsPsych;
    this.jsPsych.run(timeline);
    this.jsPsych.message_progress_bar = `${i18next.t('progressBar')}`;

    await waitFor(() => this.firekit.run.completed === true);
  }

  async abort() {
    this.firekit.abortRun();
    document.querySelectorAll('audio').forEach((el) => el.pause());
    if (this.jsPsych) {
      // enable scrolling
      document.body.style.overflow = 'visible';
      this.jsPsych.endExperiment();
    }
  }
}

export default RoarLetter;
