import { jsPsych } from "../../taskSetup";
import taskConfig from "../../taskConfig";
import { camelize } from "@bdelab/roar-utils";
import { cloneDeep } from "lodash";
import { computedScoreCallback } from "./scores";

//modifies jspsych functions to update status and write data to firestore, adds event listener for errors, sets session data
export const initTrialSaving = (config) => {
  //set jspsych display element if it exists
  if (config.displayElement) {
    jsPsych.opts.display_element = config.display_element;
  }

  // Extend jsPsych's on_finish and on_data_update lifecycle functions to mark the
  // run as completed and write data to Firestore, respectively.
  const extend = (fn, code) =>
    function () {
      // eslint-disable-next-line prefer-rest-params
      fn.apply(fn, arguments);
      // eslint-disable-next-line prefer-rest-params
      code.apply(fn, arguments);
    };

  //jspsych on finish function is modified to also do firekit.finishRun()
  jsPsych.opts.on_finish = extend(jsPsych.opts.on_finish, () => {
    config.firekit.finishRun();
  });

  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    if (data.save_trial) {
      // save_trial is a flag that indicates whether the trial should
      // be saved to Firestore. No point in writing it to the db.
      // creating a deep copy to prevent modifying of original data
      // since it is used down the line for the rest of the pipeline
      const dataCopy = cloneDeep(data);
      delete dataCopy.save_trial;
      delete dataCopy.internal_node_id;
      config.firekit.writeTrial(dataCopy, computedScoreCallback);
    }
  });
  jsPsych.opts.on_interaction_data_update = function (data) {
    config.firekit.addInteraction(data);
  };

  //initialise session data
  taskConfig[camelize(config.taskName)].initStore(config);
};
