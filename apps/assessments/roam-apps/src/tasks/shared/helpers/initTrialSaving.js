import { jsPsych } from '../../taskSetup';
import taskConfig from '../../taskConfig';
import { camelize } from '@bdelab/roar-utils';
import { cloneDeep } from 'lodash';
import { computedScoreCallback } from './scores';
import { finishRun, writeTrial, addInteraction } from '@roar-platform/assessment-sdk/compat/firekit';

let taskComplete = false;
export const isTaskComplete = () => taskComplete;

//modifies jspsych functions to update status and write data to the backend, adds event listener for errors, sets session data
export const initTrialSaving = (config) => {
  //set jspsych display element if it exists
  if (config.displayElement) {
    jsPsych.opts.display_element = config.display_element;
  }

  // Extend jsPsych's on_finish and on_data_update lifecycle functions to mark the
  // run as completed and write data to the backend, respectively.
  const extend = (fn, code) =>
    function () {
      fn.apply(fn, arguments);

      code.apply(fn, arguments);
    };

  //jspsych on finish function is modified to also finish the run via the SDK
  jsPsych.opts.on_finish = extend(jsPsych.opts.on_finish, () => {
    finishRun().then(() => {
      taskComplete = true;
    });
  });

  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    if (data.save_trial) {
      // save_trial is a flag that indicates whether the trial should
      // be saved to the backend. No point in writing it to the db.
      // creating a deep copy to prevent modifying of original data
      // since it is used down the line for the rest of the pipeline
      const dataCopy = cloneDeep(data);
      delete dataCopy.save_trial;
      delete dataCopy.internal_node_id;
      writeTrial(dataCopy, computedScoreCallback);
    }
  });
  jsPsych.opts.on_interaction_data_update = function (data) {
    addInteraction(data);
  };

  //initialise session data
  taskConfig[camelize(config.taskName)].initStore(config);
};
