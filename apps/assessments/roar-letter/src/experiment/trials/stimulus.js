import store from 'store2';
import { ifLetterNameTest, ifRealTrialResponse } from './stimulusLetterName';
import { ifPracticeCorrect, ifPracticeIncorrect } from './practice';
import { setNextStimulus, moveToNextBlock } from '../experimentSetup';
import { breakTrials } from './storySupport';
import { isMaxTimeoutReached } from './appTimer';

export const buildBlock = (preInstructions) => {
  const BREAK_INTERVAL = store.session.get('nItemsBeforeBreak');
  const BREAK_INTERVAL_PHONEME = store.session.get('nItemsBeforeBreakPhoneme');
  let trialCount = 1;
  let breakNumber = store.session.get('breakNumber') || 0;

  const breakScreen = {
    timeline: breakTrials,
    conditional_function: () => {
      if (
        BREAK_INTERVAL &&
        trialCount > 0 &&
        trialCount % BREAK_INTERVAL === 0 &&
        !store.session.get('currentCat').includes('Phoneme')
      ) {
        if (breakNumber >= 5) {
          breakNumber = 0;
        }
        store.session.set('breakNumber', breakNumber);
        breakNumber += 1;
        return true;
      }
      if (
        BREAK_INTERVAL_PHONEME &&
        trialCount > 0 &&
        trialCount % BREAK_INTERVAL_PHONEME === 0 &&
        store.session.get('currentCat').includes('Phoneme')
      ) {
        if (breakNumber >= 5) {
          breakNumber = 0;
        }
        store.session.set('breakNumber', breakNumber);
        breakNumber += 1;
        return true;
      }
      return false;
    },
  };

  const stimulusLoop = {
    timeline: [ifLetterNameTest, ifPracticeCorrect, ifPracticeIncorrect, ifRealTrialResponse, breakScreen],
    conditional_function: () => {
      if (isMaxTimeoutReached()) {
        return false;
      }
      return true;
    },
    loop_function: () => {
      trialCount += 1;
      // eslint-disable-next-line eqeqeq
      return store.session.get('nextStimulus') != undefined;
    },
  };

  return {
    timeline: [preInstructions, stimulusLoop],
    on_timeline_start: () => {
      moveToNextBlock();
      setNextStimulus();
    },
  };
};
