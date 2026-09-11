import store from 'store2';
import i18next from 'i18next';
import { startRun, abortRun } from '@roar-platform/assessment-sdk/compat/firekit';
import { wireScoreAdapter } from '../sdk/letter-firekit-facade';
import { initConfig } from './config/config';
import { buildExperiment } from './experiment';
import './styles/game.scss';
import { initSentry } from '../sentry';
import { loadCorpus } from './config/corpus.js';

class RoarLetter {
  constructor(gameParams, userParams, displayElement) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.displayElement = displayElement;
    this.jsPsych = null;
  }

  async init() {
    initSentry();
    const computedScoreCallback = wireScoreAdapter();
    await startRun(this.userParams ?? {});
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement);
    store.session.set('config', config);
    await loadCorpus(config);
    const result = buildExperiment(config, computedScoreCallback);
    return result;
  }

  async run() {
    const { jsPsych, timeline } = await this.init();
    this.jsPsych = jsPsych;
    this.jsPsych.message_progress_bar = `${i18next.t('progressBar')}`;
    await this.jsPsych.run(timeline);
  }

  async abort() {
    abortRun().catch((err) => console.warn('[roar-letter] abortRun failed:', err));
    document.querySelectorAll('audio').forEach((el) => el.pause());
    if (this.jsPsych) {
      document.body.style.overflow = 'visible';
      this.jsPsych.endExperiment();
    }
  }
}

export default RoarLetter;
