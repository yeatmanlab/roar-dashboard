import store from 'store2';
import i18next from 'i18next';
import './i18n.js';
import './styles/index.js';
import { camelize } from '@bdelab/roar-utils';
import { startRun, flushUploads } from '@roar-platform/assessment-sdk/compat/firekit';

import taskConfig from './tasks/taskConfig';
import { buildRunMetadata } from './tasks/shared/helpers/runMetadata';

import { consentView, preloadView } from './tasks/shared/views';

// Centralize window assignments so all views can access these globals
window.store = store;
window.i18next = i18next;

class TaskLauncher {
  constructor(gameParams, userParams, displayElement) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.displayElement = displayElement;
  }

  async init() {}

  async run() {
    // Consent view
    if (this.gameParams.consent) {
      await consentView();
    }

    // Operator/participant context (PID + demographics from the launch URL) is persisted to
    // run metadata — never to the user record. Empty params are omitted by buildRunMetadata.
    await startRun(buildRunMetadata(this.userParams));

    const { initConfig, buildTaskViews, audioMapping, imageAssets } = taskConfig[camelize(this.gameParams.taskName)];

    //pull language specific audio+text
    const audioMappingLang = audioMapping[i18next.language];

    //cleans the parameters and sets other variables (time, number of trials, corpus name)
    const config = await initConfig(this.gameParams, this.userParams, this.displayElement);
    //store this data in the browser
    store.session.set('config', config);

    await preloadView(config, audioMappingLang, imageAssets);

    const task = new buildTaskViews(config, audioMappingLang, this.gameParams);
    const result = await task.run();
    if (result === 'aborted') return 'aborted';

    await config.firekit.updateEngagementFlags([], true);
    // Drain any in-flight recording uploads before marking the run complete, so the final
    // recordings aren't dropped on navigation/unload.
    await flushUploads();
    await config.firekit.finishRun();
    return 'success';
  }
}

export default TaskLauncher;
