import store from 'store2';
import { jsPsych } from '../../taskSetup';
import jsPsychCallFunction from '@jspsych/plugin-call-function';

// Initialises timers
export const initBlock = (corpusName, arrayIdx) => {
  let stim = {
    type: jsPsychCallFunction,
    func: () => {
      let block = store.session.get('blockOrderRT')[arrayIdx];
      let currentCorpus = store.session.get('corpusAll')[store.session.get('taskIdx')][corpusName][block];
      store.session.set('currentCorpus', currentCorpus);
      store.session.set('subCorpusName', block);
      //allow keypress if there was not keypress before
      store.session.set('allowKeyUp', true);
    },
  };
  return stim;
};

export const setTimer = {
  type: jsPsychCallFunction,
  func: () => {
    //set timeout for ending block once 30 seconds have been exceeded
    const timerId = setTimeout(() => {
      store.session.set('timeOut', true);
      store.session.set('timeOutTime', performance.now());
      jsPsych.finishTrial();
    }, store.session.get('timerDurationRT'));
    store.session.set('timerId', timerId);
    //set starting time for showing progress bar
    if (store.session.get('startTimePB') == null) {
      let startTime = performance.now();
      store.session.set('startTimePB', startTime);
    }
    store.session.set('totalTimePB', store.session.get('timerDurationRT'));
  },
};
