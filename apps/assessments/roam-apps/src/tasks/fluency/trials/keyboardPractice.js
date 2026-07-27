import { practiceStimulusDesktop, feedbackIncorrectDesktop, feedbackCorrectDesktop } from './keyboardPracticeDesktop';
import { practiceStimulusMobile, feedbackIncorrectMobile, feedbackCorrectMobile } from './keyboardPracticeMobile';
import { isMobile } from '../helpers';
import store from 'store2';

const practiceStimulus = () => {
  let timelineObj = [practiceStimulusDesktop];

  if (isMobile) {
    timelineObj = [practiceStimulusMobile];
  }

  return {
    timeline: timelineObj,
  };
};

const incorrectLoop = () => {
  let timelineObj = [feedbackIncorrectDesktop];

  if (isMobile) {
    timelineObj = [feedbackIncorrectMobile];
  }
  return {
    timeline: timelineObj,
    loop_function: () => {
      if (store.session.get('practiceFeedback') !== 1) {
        store.session.transact('keyboardPracticeCounter', (oldVal) => oldVal + 1);
        if (store.session.get('keyboardPracticeCounter') === store.session.get('config').stopCriterion) {
          return false;
        }
      }
      if (store.session.get('practiceFeedback') === 1) {
        return false;
      }
      return true;
    },
  };
};

const ifIncorrect = {
  timeline: [incorrectLoop()],
  conditional_function: () => {
    if (store.session.get('practiceFeedback') !== 1) {
      store.session.transact('keyboardPracticeCounter', (oldVal) => oldVal + 1);
      return true;
    } else {
      return false;
    }
  },
};

const ifCorrect = () => {
  let timelineObj = [feedbackCorrectDesktop];

  if (isMobile) {
    timelineObj = [feedbackCorrectMobile];
  }
  return {
    timeline: timelineObj,
    conditional_function: () => {
      if (store.session.get('practiceFeedback') === 1) {
        return true;
      }
      return false;
    },
  };
};

//keyboard instructions with practice
export const keyboardPractice = {
  timeline: [practiceStimulus(), ifIncorrect, ifCorrect()],
  on_timeline_finish: () => {
    store.session.set('keyboardPracticeCounter', 0);
  },
};
