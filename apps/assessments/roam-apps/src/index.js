/*
Defines the main task class.
1. Sets the input variables
2. Starts the ROAR run via the assessment-sdk
3. Gets task variables,loads corpus (csv files with questions), builds timeline, initializes jspsych and runs timeline.
4. Imports css styles.
*/

import store from 'store2'; //cross browser local storage
import { camelize, generateAssetObject, createPreloadTrials } from '@bdelab/roar-utils';
import './styles/game.scss'; //getting all the css styles
import { initSentry } from './sentry';
import taskConfig from './tasks/taskConfig';
import { checkAudio, isTaskComplete, isTaskFinished } from './tasks/shared/helpers';
import i18next from 'i18next';
import { startRun, abortRun } from '@roar-platform/assessment-sdk/compat/firekit';

export let mediaAssets;
export let preloadTrials;
export class TaskLauncher {
  constructor(gameParams, userParams, isDev = false, displayElement) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.isDev = isDev;
    this.displayElement = displayElement;
  }

  async init() {
    //Start the ROAR run. Push the task and run info to the backend.
    //Call this method before starting the jsPsych experiment.
    initSentry();
    await startRun(this.userParams);

    const { taskName } = this.gameParams;

    const { initConfig, loadCorpus, buildTaskTimeline, bucketURI, assets } = taskConfig[camelize(taskName)];

    //cleans the parameters and sets other variables (time, number of trials, corpus name)
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement);
    //store this data in the browser
    store.session.set('config', config);

    //initStore();

    await loadCorpus(taskName, assets);
    mediaAssets = generateAssetObject(assets, bucketURI, i18next.language);
    preloadTrials = createPreloadTrials(assets, bucketURI, i18next.language).default;
    preloadTrials.message = i18next.t('loading');

    checkAudio(config, mediaAssets);
    //building timeline
    return buildTaskTimeline(config);
  }

  async run() {
    const { jsPsych, timeline } = await this.init();
    jsPsych.opts.show_progress_bar = this.gameParams.taskName === 'roam-alpaca' ? false : true;
    jsPsych.run(timeline);
    await isTaskFinished(() => isTaskComplete());
  }

  abort() {
    abortRun().catch((err) => console.warn('[roam-apps] abortRun failed:', err));
  }
}

export default TaskLauncher;
