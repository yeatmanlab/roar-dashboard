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
    console.log('[roar-letter] init: start', { gameParams: this.gameParams });
    initSentry();
    const computedScoreCallback = wireScoreAdapter();
    console.log('[roar-letter] init: wireScoreAdapter done');
    await startRun(this.userParams ?? {});
    console.log('[roar-letter] init: startRun done');
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement);
    console.log('[roar-letter] init: initConfig done', { task: config.task, language: config.language, scoringVersion: config.scoringVersion });
    store.session.set('config', config);
    await loadCorpus(config);
    console.log('[roar-letter] init: loadCorpus done');
    const result = buildExperiment(config, computedScoreCallback);
    console.log('[roar-letter] init: buildExperiment done', { timelineLength: result.timeline.length });
    return result;
  }

  async run() {
    console.log('[roar-letter] run: start');
    const { jsPsych, timeline } = await this.init();
    console.log('[roar-letter] run: calling jsPsych.run with', timeline.length, 'nodes');
    this.jsPsych = jsPsych;
    this.jsPsych.message_progress_bar = `${i18next.t('progressBar')}`;
    await this.jsPsych.run(timeline);
    console.log('[roar-letter] run: jsPsych.run complete');
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
