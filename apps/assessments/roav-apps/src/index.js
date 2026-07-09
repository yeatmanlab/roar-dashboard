/*
Defines the main task class.
1. Sets the input variables
2. Starts the ROAR firekit run function
3. Gets task variables,loads corpus (csv files with questions), builds timeline, initializes jspsych and runs timeline.
4. Imports css styles.
*/

import { camelize } from '@bdelab/roar-utils';
import { isTaskFinished } from './tasks/shared/helpers/isTaskFinished';
import './styles/styles.scss'; // getting all the css styles
import { initSentry } from './sentry';
import { initPreloadTrials } from './tasks/shared/trials/preloadTrials';
import { initTrialSaving } from './tasks/shared/helpers/initTrialSaving';
import taskConfig from './tasks/taskConfig';
import { initMediaAssets } from './tasks/shared/helpers/mediaAssets';
import { sessionSet } from './tasks/shared/helpers/sessionHelpers';
import { SESSION_KEYS as SK } from './tasks/shared/helpers/sessionKeys';

export class TaskLauncher {
  constructor(firekit, gameParams, userParams, displayElement) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.firekit = firekit;
    this.displayElement = displayElement;
  }

  async init() {
    initSentry();
    await this.firekit.startRun();

    const { taskName } = this.gameParams;

    const { initConfig, initStore, loadCorpus, buildTimelineTask, bucketURI, assets } = taskConfig[camelize(taskName)];

    const config = await initConfig(this.firekit, this.gameParams, this.userParams, this.displayElement);
    sessionSet(SK.CONFIG, config);

    initStore();

    await loadCorpus(taskName, assets, bucketURI);

    initMediaAssets(assets, bucketURI);

    initPreloadTrials(assets, bucketURI);

    initTrialSaving(config);
    return buildTimelineTask(config);
  }

  async run() {
    const { jsPsych, timeline } = await this.init();
    jsPsych.run(timeline);
    await isTaskFinished(() => this.firekit.run.completed === true);
  }
}

export default TaskLauncher;
