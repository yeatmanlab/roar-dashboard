import store from "store2";
import i18next from "i18next";
import "./i18n.js";
import "./styles/index.js";
import { camelize } from "@bdelab/roar-utils";

import taskConfig from "./tasks/taskConfig";

import {
  calibrationView,
  configureDeviceView,
  consentView,
  preloadView,
} from "./tasks/shared/views";

// Centralize window assignments so all views can access these globals
window.store = store;
window.i18next = i18next;

class TaskLauncher {
  constructor(firekit, gameParams, userParams, displayElement) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.firekit = firekit;
    this.displayElement = displayElement;
  }

  async init() {}

  async run() {
    // Consent view
    if (this.gameParams.consent) {
      await consentView();
    }

    await this.firekit.startRun();
    
    const {
      initConfig,
      buildTaskViews,
      audioMapping,
      imageAssets
    } = taskConfig[camelize(this.gameParams.taskName)];

    //pull language specific audio+text
    const audioMappingLang = audioMapping[i18next.language];

    //cleans the parameters and sets other variables (time, number of trials, corpus name)
    const config = await initConfig(
      this.firekit,
      this.gameParams,
      this.userParams,
      this.displayElement,
    );
    //store this data in the browser
    store.session.set("config", config);

    await preloadView(config, audioMappingLang, imageAssets);

    // Uncomment to check run level information in firestore
    // console.log("Run info :", config.firekit.run.runRef.id);

    const task = new buildTaskViews(config, audioMappingLang, this.gameParams);
    const result = await task.run();
    if (result === "aborted") return "aborted";

    await config.firekit.updateEngagementFlags([], true);
    await config.firekit.finishRun();
    return "success";
  }
}

export default TaskLauncher;
