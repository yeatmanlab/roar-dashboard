import store from 'store2';
import { startRun, abortRun } from '@roar-platform/assessment-sdk/compat/firekit';
import { wireScoreAdapter } from '../sdk/multichoice-firekit-facade';
import { initConfig } from './config/config';
import { buildExperiment } from './experiment';
import './styles/game.scss';
import { loadCorpus } from './config/corpus';
import { initSentry } from './sentry';

class RoarMultichoice {
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
    await loadCorpus(
      config.practiceCorpus,
      config.stimulusCorpus,
      config.sequentialPractice,
      config.sequentialStimulus,
    );
    return buildExperiment(config, computedScoreCallback);
  }

  async run() {
    const { jsPsych, timeline } = await this.init();
    this.jsPsych = jsPsych;
    await this.jsPsych.run(timeline);
  }

  async abort() {
    abortRun().catch((err) => console.warn('[roar-multichoice] abortRun failed:', err));
    if (this.jsPsych) {
      this.jsPsych.endExperiment();
    }
  }
}

export default RoarMultichoice;
