import { cloneDeep } from 'lodash';
import { jsPsych } from './taskSetup';

// sets session data AND
// modifies jspsych functions to
// - update status
// - write data to firestore
// - adds event listener for errors

// jsPsych.opts exposes configuration through .opts (packages/jspsych/src/jspsych.ts)
//        .opts keeps track of global callbacks, like on_finish - that is how we can mutate it

// jsPsych assessment stages the SDK accepts for a trial write. roav-apps also emits
// 'data' / 'instruction' / 'none' stage trials (device config, screen calibration, QUEST
// params) that carry no `correct` field; the SDK rejects those stages, so they are filtered
// out in on_data_update below.
const WRITABLE_STAGES = new Set(['practice', 'practice_response', 'test', 'test_response']);

// computedScoreCallback for writeTrial: roav-apps performs no score computation (no IRT /
// normed scoring), so the accumulated raw counts from the facade — already shaped as
// { composite: { practice, test } } — pass straight through to toRoavAppsScoreEntries.
const callbackTrialSaving = async (rawScores) => rawScores;

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
    // Skip trials with a stage the SDK rejects (data/instruction/none metadata trials), and
    // skip writes after finishRun() has cleared the runId (a further writeTrial would throw).
    const assessmentStage = data.assessment_stage ?? data.assessmentStage;
    if (data.save_trial && WRITABLE_STAGES.has(assessmentStage) && !config.firekit.run.completed) {
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
