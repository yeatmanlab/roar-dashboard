import store from 'store2';
import _clamp from 'lodash/clamp';
import { jsPsych } from './jsPsych';
import { audioContext } from './trials/stimulusLetterName';
import { mediaAssets } from './experiment';
import { clowder } from './experimentSetup';
import { PHONICS_TASK_IDS, LETTER_CAT_NAMES } from '@roar-platform/assessment-schema/roar-letter';

export const shuffle = (array) => {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

    // swap elements array[i] and array[j]
    // use "destructuring assignment" syntax
    // eslint-disable-next-line no-param-reassign
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
};

export const waitFor = (conditionFunction) => {
  const poll = (resolve) => {
    if (conditionFunction()) {
      document.body.style.overflow = 'visible';
      resolve();
    }
    // eslint-disable-next-line no-unused-vars
    else setTimeout((_) => poll(resolve), 400);
  };

  return new Promise(poll);
};

export const updateProgressBar = () => {
  const currProgressBar = jsPsych.getProgressBarCompleted();

  const letterTrialsTotal = [
    clowder.earlyStopping.requiredItems[LETTER_CAT_NAMES.LETTER_NAME_LOWER] +
      clowder.earlyStopping.requiredItems[LETTER_CAT_NAMES.LETTER_NAME_UPPER],
  ].reduce((curr, total) => curr + total, 0);
  const phonemeTrialsTotal = [clowder.earlyStopping.requiredItems[LETTER_CAT_NAMES.LETTER_PHONEME]].reduce(
    (curr, total) => curr + total,
    0,
  );
  const phonicsTrialsTotal = store.session.get('phonicsTrialsTotal');

  const trialTotal = letterTrialsTotal + phonemeTrialsTotal;
  const { task } = store.session.get('config');

  if (task === PHONICS_TASK_IDS.EN) {
    jsPsych.setProgressBar(currProgressBar + 1 / phonicsTrialsTotal);
  } else {
    jsPsych.setProgressBar(currProgressBar + 1 / trialTotal);
  }
};

// add an item to a list in the store, creating it if necessary
export const addItemToSortedStoreList = (tag, entry) => {
  if (!store.session.has(tag)) {
    // eslint-disable-next-line no-console
    console.warn(`uninitialized store tag: ${tag}`);
  } else {
    // read existing list
    const sortedList = store.session(tag);

    let index = 0;
    while (index < sortedList.length && entry >= sortedList[index]) {
      index += 1;
    }

    // Use the splice method to insert the entry at the appropriate position
    sortedList.splice(index, 0, entry);
    store.session.set(tag, sortedList);
  }
};

export function replayAudioStimulus() {
  let stim;
  const { task } = store.session.get('config');
  if (task === PHONICS_TASK_IDS.EN) {
    stim = store.session.get('nextStimulus').audio_filename;
  } else {
    stim = store.session.get('nextStimulus').audioFile;
  }
  audioContext.src = mediaAssets.audio[stim];
  audioContext.play();
  store.session.transact('ifReplay', (oldVal) => oldVal + 1);
}

export const makeFinite = (num) => _clamp(num, Number.MIN_VALUE, Number.MAX_VALUE);
