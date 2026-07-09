/*
Defines the main task class.
1. Sets the input variables
2. Starts the ROAR firekit run function
3. Gets task variables,loads corpus (csv files with questions), builds timeline, initializes jspsych and runs timeline.
4. Imports css styles.
*/

import { camelize } from '@bdelab/roar-utils';
import { startRun } from '@roar-platform/assessment-sdk/compat/firekit';
import { isTaskFinished } from './tasks/shared/helpers/isTaskFinished';
import './styles/styles.scss'; // getting all the css styles
import { initSentry } from './sentry';
import { wireScoreAdapter } from './sdk/roav-apps-firekit-facade.js';
import { buildRunMetadata } from './tasks/shared/helpers/runMetadata';
import { initPreloadTrials } from './tasks/shared/trials/preloadTrials';
import { initTrialSaving } from './tasks/shared/helpers/initTrialSaving';
import taskConfig from './tasks/taskConfig';
import { initMediaAssets } from './tasks/shared/helpers/mediaAssets';
import { sessionSet } from './tasks/shared/helpers/sessionHelpers';
import { SESSION_KEYS as SK } from './tasks/shared/helpers/sessionKeys';

export class TaskLauncher {
  constructor(gameParams, userParams, displayElement) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.displayElement = displayElement;
  }

  async init() {
    initSentry();
    wireScoreAdapter();
    // Operator/participant-supplied context (PID + demographics from the launch URL) is
    // persisted to run metadata — never to the user record. Absent/empty URL params are
    // omitted so metadata only carries what was actually provided.
    await startRun(buildRunMetadata(this.userParams));

    const { taskName } = this.gameParams;

    const { initConfig, initStore, loadCorpus, buildTimelineTask, bucketURI, assets } = taskConfig[camelize(taskName)];

    const config = await initConfig(this.gameParams, this.userParams);
    this.config = config;
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
    await isTaskFinished(() => this.config.firekit.run.completed === true);
  }
}

export default TaskLauncher;
