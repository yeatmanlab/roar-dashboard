import { cloneDeep } from 'lodash';
import { jsPsych } from './taskSetup';

// sets session data AND
// modifies jspsych functions to
// - update status
// - write data to firestore
// - adds event listener for errors

// jsPsych.opts exposes configuration through .opts (packages/jspsych/src/jspsych.ts)
//        .opts keeps track of global callbacks, like on_finish - that is how we can mutate it

const callbackTrialSaving = () => {
  // placeholder
};

export const initTrialSaving = (config) => {
  // Extend jsPsych's on_finish and on_data_update lifecycle functions to mark the
  // run as completed and write data to Firestore, respectively.
  const extend = (fn, code) =>
    function () {
      // eslint-disable-next-line prefer-rest-params
      fn.apply(fn, arguments);
      // eslint-disable-next-line prefer-rest-params
      code.apply(fn, arguments);
    };

  jsPsych.opts.on_finish = extend(jsPsych.opts.on_finish, () => {
    config.firekit.finishRun();
  });

  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    if (data.save_trial) {
      const dataCopy = cloneDeep(data);
      delete dataCopy.save_trial;
      delete dataCopy.internal_node_id;
      config.firekit.writeTrial(dataCopy, callbackTrialSaving);
    }
  });

  jsPsych.opts.on_interaction_data_update = function (data) {
    config.firekit.addInteraction(data);
  };
};
