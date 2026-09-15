import store from 'store2';
import { symComp } from './symComp';
import { updateStimulus } from '../../shared/helpers';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { jsPsych } from '../../taskSetup';

const symCompTrialSeq = (corpusName, assessment_stage_val) => {
  return {
    timeline: [updateStimulus(corpusName), symComp(assessment_stage_val)],
    on_timeline_start: () => {
      document.getElementById('jspsych-progressbar-container').style.visibility = 'visible';
    },
    loop_function: () => {
      if (store.session.get('timeOut') || store.session.get('currentCorpus').length === 0) {
        // repeat until either max trials is reached or if timer is complete
        store.session.set('indexTracking', -1);
        if (store.session.get('timeOut') === true) {
          store.session.set('timeOut', false);
          store.session.set('timeOutTime', null);
        }
        store.session.set('timeForceOut', false);
        clearTimeout(store.session.get('timerId'));
        clearTimeout(store.session.get('timerForceId'));
        document.getElementById('jspsych-progressbar-container').style.visibility = 'hidden';
        return false;
      }
      return true;
    },
  };
};

export const initCompBlock = (corpusName, taskType) => {
  return {
    type: jsPsychCallFunction,
    func: () => {
      if (store.session.get('indexTracking') === -1) {
        let arrayIdx = store.session.get('arrayIdx');
        let block = store.session.get('blockOrder')[corpusName][arrayIdx];
        let corpus = store.session.get('corpusAll')[store.session.get('taskIdx')][corpusName][block];
        store.session.set('currentCorpus', corpus);
        store.session.set('corpusLength', corpus.length);
        if (corpusName === 'practice') {
          store.session.set('subCorpusName', taskType + '_practice');
        } else {
          store.session.set('subCorpusName', taskType + '_' + block);
          jsPsych.setProgressBar(0); //reset progress bar
        }
      }
    },
  };
};

const setTimer = {
  type: jsPsychCallFunction,
  func: () => {
    //set timeout for ending trials once 3 minutes have been exceeded
    const timerId = setTimeout(() => {
      store.session.set('timeOut', true);
      store.session.set('timeOutTime', performance.now());
    }, store.session.get('timerDurationSym'));
    store.session.set('timerId', timerId);

    //set an additional timeout for force exiting, to prevent page inactivity
    const timerForceId = setTimeout(
      () => {
        store.session.set('timeForceOut', true);
        jsPsych.finishTrial();
      },
      store.session.get('timerDurationSym') + store.session.get('timerForceQuitSym'),
    );
    store.session.set('timerForceId', timerForceId);
    if (store.session.get('startTimePB') == null) {
      let startTime = performance.now();
      store.session.set('startTimePB', startTime);
    }
    store.session.set('totalTimePB', store.session.get('timerDurationSym'));
  },
};

export const symCompBlock = (corpusName, assessment_stage_val, taskType) => {
  return {
    timeline: [initCompBlock(corpusName, taskType), setTimer, symCompTrialSeq(corpusName, assessment_stage_val)],
  };
};
