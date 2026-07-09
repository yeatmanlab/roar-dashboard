import store from 'store2'; //storing browser data
import { camelize } from '@bdelab/roar-utils';
import { getDevice } from '@bdelab/roar-utils';
import i18next from 'i18next';

export const isMobile = getDevice() === 'mobile';

//sets session data
export const initStoreFluency = () => {
  if (store.session.has('initialized') && store.local('initialized')) {
    return store.session;
  }

  let config = store.session.get('config');

  //variables that need to be set once at the beginning and are not touched later

  store.session.set('responseModality', false);
  store.session.set('magpiPilot', false);

  //additional task conditions embedded within fluency
  if (config.recruitment === 'responseModality') {
    store.session.set('responseModality', true);
    //set separate counters to keep track of correct per task
    store.session.set('trialNumTotalAFC', 0); //overall attempted afc
    store.session.set('trialNumTotalProduction', 0); //overall attempted production
    store.session.set('trialNumTotalControl2afc', 0); //overall attempted rt control
    store.session.set('trialNumTotalControl6afc', 0); //overall attempted rt control
    store.session.set('trialNumTotalControlProduction', 0); //overall attempted rt control
    store.session.set('timerDurationRT', 30000); //set the duration of timer (ms)
    store.session.set('rtControlMouseInstruction', false); //controls whether I need to show mouse instructions
  }
  if (config.recruitment === 'magpiPilot' && config.taskName === 'fluency-arf') {
    store.session.set('magpiPilot', true);
    store.session.set('timerDurationSym', 90000);
    store.session.set('timerForceQuitSym', 5000);
  }

  //whether there should be keyboard practice
  if (config.keyboardPractice === true) {
    store.session.set('keyboardInstruction', 'practice');
  } else {
    store.session.set('keyboardInstruction', 'noPractice');
  }

  //display image for instructions
  store.session.set('displayImage', camelize(config.taskName + '-display'));
  if (i18next.language === 'es') {
    store.session.set('displayImage', 'tiger');
  }
  if (config.labId === 'numberLab') {
    store.session.set('displayImage', camelize(config.taskName + '-display'));
  }

  // clear any timers if they exist in the browser
  if (store.session.get('timerId')) {
    clearTimeout(store.session.get('timerId'));
  }
  store.session.set('timerId', null);

  if (store.session.get('timerForceId')) {
    clearTimeout(store.session.get('timerForceId'));
  }
  store.session.set('timerForceId', null);

  if (store.session.get('timerIdCountdown')) {
    clearTimeout(store.session.get('timerIdCountdown'));
  }
  store.session.set('timerIdCountdown', null);

  //not used here but could still exist from Alpaca
  if (store.session.get('intervalId')) {
    clearInterval(store.session.get('intervalId'));
  }
  store.session.set('intervalId', null);

  if (store.session.get('intervalId2')) {
    clearInterval(store.session.get('intervalId2'));
  }
  store.session.set('intervalId2', null);

  // for storing next stimulus
  store.session.set('nextStimulus', null);
  // stores binary correct/incorrect
  store.session.set('dataCorrect', null);
  // stores timeout status for deciding of a trial data should be saved
  store.session.set('timeOut', false);
  // stores time at which time out occurs
  store.session.set('timeOutTime', null);
  // stores 2nd timer status for force quitting
  store.session.set('timeForceOut', false);
  // stores the name of subtask (eg: block0, rtControl_2afc_block0, symbolicComp_block0)
  store.session.set('subCorpusName', null);
  // this is used to get the corpus of subtasks (RT control, symbolic comparison, ARF/CALF multiple modalities)
  store.session.set('taskIdx', 0);
  // stores the current working corpus, gets initialised at the start of every block
  store.session.set('currentCorpus', '');
  // index for keeping track of trials, should get ini
  store.session.set('indexTracking', -1);

  // keyboard practice
  store.session.set('practiceKeyPress', null);
  store.session.set('response', null);
  store.session.set('practiceIncorrectCount', 0);
  store.session.set('practiceFeedback', null);
  store.session.set('keyboardPracticeCounter', 0);

  // allows first key press, this gets added everywhere so maybe don't need it here?
  store.session.set('allowKeyUp', false);

  store.session.set('totalCorrect', 0); // overall correct
  store.session.set('trialNumTotal', 0); // counter for all attempted trials

  /*initialise before each task: 
  - timer duration (separate timer duration), timer force quit (separate timer force quit), startTimePB, totalTimePB
  - blockOrder, arrayIdx, 
  */

  if (config.taskName === 'fluency-arf') {
    store.session.set('timerDuration', [180000]); //set the duration of timer (ms)
    store.session.set('timerForceQuit', 30000);
    //order of blocks
    store.session.set('blockOrder', {
      practice: ['practice'],
      stimulus: ['block0'],
    });
    if (config.recruitment === 'demo') {
      store.session.set('timerDuration', [30000]); //set the duration of timer (ms)
      store.session.set('timerForceQuit', 10000);
    }
  } else if (config.taskName === 'fluency-calf') {
    store.session.set('timerDuration', [60000, 60000, 60000]); //set the duration of timer (ms)
    //increase the time only for prolific number lab study
    if (
      (config.recruitment === 'prolific' && config.labId === 'numberLab') ||
      store.session.get('responseModality') ||
      store.session.get('config').userMode === '4andHalfMin'
    ) {
      store.session.set('timerDuration', [90000, 90000, 90000]); //set the duration of timer (ms)
    }
    store.session.set('timerForceQuit', 20000);

    //order of blocks
    store.session.set('blockOrder', {
      practice: ['practice'],
      stimulus: ['block0', 'block1', 'block2'],
    });
    if (config.recruitment === 'demo') {
      store.session.set('timerDuration', [30000]); //set the duration of timer (ms)
      store.session.set('timerForceQuit', 10000);
      store.session.set('blockOrder', {
        practice: ['practice'],
        stimulus: ['block0'],
      });
    }
  }
  store.session.set('arrayIdx', 0);
  // progress bar tracking
  store.session.set('startTimePB', null);
  store.session.set(
    'totalTimePB',
    store.session.get('timerDuration').reduce((a, b) => a + b),
  );

  //name to save subtask in scores
  store.session.set('operatorMap', {
    '+': 'addition',
    '-': 'subtraction',
    '&times': 'multiplication',
    '&divide': 'division',
  });
  store.session.set('assessedSkills', {});
  store.session.set('assessedFacts', { multiplication: [], division: [] });
  store.session.set('remSkillsMultDiv', { multiplication: [], division: [] });
  store.session.set('incorrectSkills', {});
  store.session.set('factsArr', []);
  store.session.set('worstFacts', []);
  store.session.set('worstFactsCount', 3);

  //re-initialise before each block
  store.session.set('correctCount', 0); //correct counter per block/corpus
  store.session.set('indexTracking', -1);

  // variables that I don't really need

  //don't really need this, since it will always be true
  store.session.set('evaluateValidity', true);

  // this should be the last set before return
  store.session.set('initialized', true);

  return store.session;
};
