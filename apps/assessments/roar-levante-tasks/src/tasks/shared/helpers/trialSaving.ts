import { jsPsych } from '../../taskSetup';
import cloneDeep from 'lodash/cloneDeep';
import _mapValues from 'lodash/mapValues';
import { taskStore } from '../../../taskStore';
import { recordCompletion } from './recordCompletion';
import { Logger } from '../../../utils/logger';
import { finishExperiment } from '../trials';
import { shouldUseClowder } from './shouldUseClowder';
import { ScoringHandler } from './scoringHandler';

export const initTrialSaving = (config: Record<string, any>) => {
  if (config.displayElement) {
    // @ts-ignore
    jsPsych.opts.display_element = config.display_element;
  }

  // Extend jsPsych's on_finish and on_data_update lifecycle functions to mark the
  // run as completed and write data to Firestore, respectively.
  const extend = (fn: Function, code: Function) =>
    function () {
      // eslint-disable-next-line prefer-rest-params
      fn.apply(fn, arguments);
      // eslint-disable-next-line prefer-rest-params
      code.apply(fn, arguments);
    };

  // @ts-ignore
  jsPsych.opts.on_finish = extend(jsPsych.opts.on_finish, () => {
    // Add finishing metadata to run doc
    // const finishingMetadata = {}
    // const { maxTimeReached, numIncorrect, maxIncorrect } = taskStore();

    // if (maxTimeReached) {
    //   finishingMetadata.reasonTaskEnded = 'Max Time'
    // } else if (numIncorrect >= maxIncorrect) {
    //   finishingMetadata.reasonTaskEnded = 'Max Incorrect Trials'
    // } else {
    //   finishingMetadata.reasonTaskEnded = 'Completed Task'
    // }

    // config.firekit.finishRun(finishingMetadata);

    config.firekit.finishRun();
  });

  // @ts-ignore
  jsPsych.opts.on_trial_finish = extend(jsPsych.opts.on_trial_finish, () => {
    if (taskStore().maxTimeReached) {
      finishExperiment();
    }

    // record completion at 80%
    if (taskStore().testTrialCount >= taskStore().totalTestTrials * 0.8) {
      recordCompletion(config);
    }

    taskStore('totalTrialCount', taskStore().totalTrialCount + 1);
  });

  let scoringHandler: ScoringHandler | null = null;
  let scoreCallback: ((rawScores: Record<string, any>) => any) | null = null;

  if (config.isRoarApp) {
    scoringHandler = new ScoringHandler(config.task, config.scoringVersion, config.userMetadata);

    // Create closure that captures taskStore reference
    // Equivalent to RoarScore.computedScoreCallback
    scoreCallback = async (rawScores: Record<string, any>) => {
      scoringHandler!.totalCorrect = taskStore().totalCorrect;
      scoringHandler!.irtEstimates = taskStore().irtEstimates;
      return scoringHandler!.computedScoreCallback(rawScores);
    };
  }

  // @ts-ignore
  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    // Only write trials with an assessment stage the SDK accepts. Corpora may embed
    // instruction items (assessmentStage: 'instructions' or 'instruction') alongside
    // test items — the SDK rejects both. Use a positive allowlist so any unrecognised
    // stage value is silently skipped rather than causing a runtime error.
    // Also skip writes after finishRun() has been called at 80% completion — the SDK
    // clears the runId at that point, and any further writeTrial calls would throw.
    const WRITABLE_STAGES = new Set(['practice', 'practice_response', 'test', 'test_response']);
    const assessmentStageValue = data.assessment_stage ?? data.assessmentStage;
    if (data.save_trial && WRITABLE_STAGES.has(assessmentStageValue) && !config?.firekit?.run?.completed) {
      // save_trial is a flag that indicates whether the trial should
      // be saved to Firestore. No point in writing it to the db.
      // creating a deep copy to prevent modifying of original data
      // since it is used down the line for the rest of the pipeline

      const dataCopy = cloneDeep(data);
      delete dataCopy.save_trial;
      delete dataCopy.internal_node_id;
      delete dataCopy.button_response;
      delete dataCopy.response_source;
      dataCopy.responseSource = data.response_source;
      delete dataCopy.trial_type;
      dataCopy.trialIndex = dataCopy.trial_index;
      delete dataCopy.trial_index;
      dataCopy.taskId = taskStore().task;
      if (config.isRoarApp) {
        config.firekit.writeTrial(dataCopy, scoreCallback!);
      } else {
        config.firekit.writeTrial(dataCopy).catch((error: any) => {
          delete dataCopy.stimulus; // remove stimulus from data to avoid logging large html elements
          Logger.getInstance().capture('Error writing trial to Firestore', { error: error, data: dataCopy });
        });
      }
    }
  });
};
