 
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
    // jsPsych.run() resolves after the full timeline completes (including on_finish),
    // which is when finishRun() fires. Awaiting it preserves the completion contract
    // that callers (e.g. TaskPA.vue) depend on to call completeAssessment and navigate.
    await this.jsPsych.run(timeline);
  }

  async abort() {
    document.querySelectorAll('audio').forEach((el) => el.pause());
    if (this.jsPsych) {
      this.jsPsych.endExperiment();
    }
    // Order so that UI teardown is synchronous; backend abort is best-effort,
    // but log on failure so we know the server's run state may be stale.
    abortRun().catch((err) => {
      console.warn('abortRun failed; backend run state may be stale', err);
    });
  }
}

export default RoarPA;
