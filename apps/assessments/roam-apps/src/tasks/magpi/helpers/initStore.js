import store from 'store2';

const initNumLine = () => {
  let grade = store.session.get('grade');
  if (grade < 3 || grade === undefined) {
    store.session.set('blockOrderNumLine', {
      stimulus: ['block0', 'block1'],
    });
  } else {
    store.session.set('blockOrderNumLine', {
      stimulus: ['block0', 'block1', 'block2'],
    });
  }

  store.session.set('blockType', null);
  //slider step size
  store.session.set('blockStepInstruction', {
    20: 0.02,
    100: 0.1,
    1: 0.001,
    2: 0.002,
  });

  //for practice feedback
  store.session.set('perError', null);

  store.session.set('arrayIdx', 0);

  store.session.set('numberLineTimeLimit', 15000); //in ms
  store.session.set('numberLineCountdownTime', 5); //in sec
  store.session.set('numberLineCountdownAppears', 10000); //in ms
  store.session.set('timerId', null);
  store.session.set('timerIdCountdown', null);
};

export const initSymComp = () => {
  //initialise block index
  store.session.set('arrayIdx', 0);

  store.session.set('timeForceOut', false);
  store.session.set('timerDuration', [2000]);
  store.session.set('timerForceQuit', 2000);
  store.session.set('startTimePB', null);
  store.session.set(
    'totalTimePB',
    store.session.get('timerDuration').reduce((a, b) => a + b),
  );
  store.session.set('timeOutTime', null);
  store.session.set('corpusLength', null);

  store.session.set('blockOrderSymComp', {
    practice: ['practice'],
    stimulus: ['block0'],
  });
};

export const initStoreMagpi = () => {
  /*if (store.session.has("initialized") && store.local("initialized")) {
    return store.session;
  }*/
  // clear any timers if they exist in the browser
  if (store.session.get('timerId')) {
    clearTimeout(store.session.get('timerId'));
  }
  store.session.set('timerId', null);

  if (store.session.get('timerId2')) {
    clearTimeout(store.session.get('timerId2'));
  }
  store.session.set('timerId2', null);

  if (store.session.get('timerIdCountdown')) {
    clearTimeout(store.session.get('timerIdCountdown'));
  }
  store.session.set('timerIdCountdown', null);

  if (store.session.get('intervalId')) {
    clearInterval(store.session.get('intervalId'));
  }
  store.session.set('intervalId', null);

  if (store.session.get('intervalId2')) {
    clearInterval(store.session.get('intervalId2'));
  }

  // for storing next stimulus
  store.session.set('nextStimulus', null);

  store.session.set('trialNumTotal', 0); // counter for trials in experiment
  store.session.set('dataCorrect', null);

  store.session.set('timeOut', false); // initialise the time out variable

  store.session.set('taskIdx', 0);

  store.session.set('magpiPilot', false);

  // working copy of the corpuses (items are removed as they are used)
  store.session.set('currentCorpus', ''); //initialise current corpus as empty string, gets updated in stimulusNumber.js

  // index for keeping track of trials for timer
  store.session.set('indexTracking', -1);

  initNumLine();
  initSymComp();

  // this should be the last set before return
  store.session.set('initialized', true);

  return store.session;
};
