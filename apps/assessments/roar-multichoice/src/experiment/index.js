 
import store from 'store2';
import { initConfig } from './config/config';
import { buildExperiment } from './experiment';
import { waitFor } from './helperFunctions';
import './styles/game.scss';
import { loadCorpus } from './config/corpus';
import { initSentry } from './sentry';

class RoarMultichoice {
  constructor(firekit, gameParams, userParams, displayElement) {
    // TODO: Add validation of params so that if any are missing, we throw an error
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.firekit = firekit;
    this.displayElement = displayElement;
  }

  async init() {
    initSentry();
    await this.firekit.startRun();
    const config = await initConfig(this.firekit, this.gameParams, this.userParams, this.displayElement);
    store.session.set('config', config);
    await loadCorpus(
      config.practiceCorpus,
      config.stimulusCorpus,
      config.sequentialPractice,
      config.sequentialStimulus,
    );
    return buildExperiment(config);
  }

  async run() {
    const { jsPsych, timeline } = await this.init();
    jsPsych.run(timeline);
    await waitFor(() => this.firekit.run.completed === true);
  }
}

export default RoarMultichoice;
