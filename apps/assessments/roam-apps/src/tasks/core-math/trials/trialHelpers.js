import store from 'store2';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { getDevice } from '@bdelab/roar-utils';
import { clowder } from '../../core-math/helpers/fetchAndParseCorpus';
import { computeAllGradeEstimates } from './gradeEstimateHelpers';

export const isMobile = getDevice() === 'mobile';

export const initBlock = (corpusName, idx) => {
  let stim = {
    type: jsPsychCallFunction,
    func: () => {
      let currentCorpus = store.session.get('corpusAll')[corpusName][idx];
      let currentCorpusName = store.session.get('corpusNamesMap')[idx];
      //check if the lower items need to be run
      if (currentCorpus.length != 0) {
        if (currentCorpusName === 'lower') {
          //run the lower items if at least 1 is incorrect in the "to check" items (determines whether they continue or go back)
          if (store.session.get('gradeEstimateObject').composite.totalCorrect !== store.session.get('itemsToCheck')) {
            store.session.set('corpusToRun', 'lower');

            //save the responses to separate array and reset the response tracker
            store.session.set('checkResponseTracker', store.session.get('responseTracker'));
            store.session.set('responseTracker', []);

            let breakMapping = store.session.get('breakMappingLower');
            let grade = store.session.get('grade');
            if (grade >= 5) {
              store.session.set('breakMap', breakMapping['5-12']);
            } else if (grade == 3 || grade == 4) {
              store.session.set('breakMap', breakMapping['3-4']);
            } else {
              store.session.set('breakMap', breakMapping['K-2']);
            }
          } else {
            store.session.set('corpusToRun', 'remaining');
          }
        } else {
          store.session.set('corpusToRun', currentCorpusName);
        }
      }
      // if this is the first trial in this block, we will: update the corpus
      if (store.session.get('corpusComplete') && currentCorpusName === store.session.get('corpusToRun')) {
        store.session.set('currentCorpus', currentCorpus);
        store.session.set('currentCorpusName', currentCorpusName);
        store.session.set('corpusComplete', false);

        //allow keypress if there was not keypress before
        store.session.set('allowKeyUp', true);
      }
    },
  };
  return stim;
};

const catOrderMap = {
  0: 'cat1',
  1: 'cat2',
  2: 'cat3',
  3: 'cat4',
};

// Non-userMode testing: gets the next stimulus in the corpus
const getNextStimulus = (corpusName) => {
  let corpus, nextStimulus, remainingStimuli;
  // read the current version of the corpus
  corpus = store.session.get('currentCorpus');

  if (store.session.get('config').userMode === 'adaptive' && corpusName === 'stimulus') {
    let catIndex = store.session.get('currentCatIndex');

    if (catIndex == undefined) {
      store.session.set('currentCatIndex', 0);
      catIndex = 0;
    }

    const catName = catOrderMap[catIndex];
    const previousItem = store.session.get('previousItem');
    const previousAnswer = store.session.get('previousAnswer');

    const nextStimulus = clowder.updateCatAndGetNextItem({
      catToSelect: catName,
      catsToUpdate: ['total', 'cat1', 'cat2', 'cat3', 'cat4'],
      items: previousItem ?? undefined,
      answers: previousAnswer ?? undefined,
      randomlySelectUnvalidated: false,
    });

    if (nextStimulus === undefined) {
      store.session.remove('nextStimulus');
      const catIndex = (store.session.get('currentCatIndex') ?? -1) + 1;
      store.session.set('currentCatIndex', catIndex);
      if (catIndex < 4) {
        getNextStimulus(corpusName);
      }
    } else {
      store.session.set('nextStimulus', nextStimulus);
    }
  } else {
    // chose the next stimulus
    nextStimulus = corpus[0];
    //if instruction, update the index
    if (nextStimulus.item_type.includes('Instruction')) {
      store.session.transact('indexTracking', (oldVal) => oldVal - 1);
      store.session.transact('indexTrackingPractice', (oldVal) => oldVal + 1);
    }
    // get the remaining stimuli
    remainingStimuli = corpus.slice(1);
    // store the item for use in the trial
    store.session.set('nextStimulus', nextStimulus);
    // update the corpus with the remaining unused items
    corpus = remainingStimuli;
    store.session.set('currentCorpus', corpus);
  }
  if (
    store.session.get('grade') > 4 ||
    !Object.hasOwn(store.session.get('nextStimulus'), 'audio_file') ||
    (Object.hasOwn(store.session.get('nextStimulus'), 'audio_file') &&
      store.session.get('nextStimulus').audio_file === '')
  ) {
    store.session.set('replayButton', false);
  }
};

export const updateStimulus = (corpusName) => ({
  type: jsPsychCallFunction,
  func: () => {
    // for keeping track of number of trials completed
    if (store.session.get('currentCorpus').length !== 0) {
      store.session.transact('indexTracking', (oldVal) => oldVal + 1);
      getNextStimulus(corpusName);
    }
  },
});

export const addResponse = (value, maxLength) => {
  let responses = store.session.get('responseTracker');
  // Add the new response to the end of the array
  responses.push(value);

  // If the array length exceeds 5, remove the oldest value
  if (responses.length > maxLength) {
    responses.shift();
  }
  store.session.set('responseTracker', responses);
};

const checkEndBlock = (arr, stopCriterion, maxLength) => {
  //end block if
  // 1. the stop criterion is reached OR
  // 2. the last trial of the remaining corpus has been completed

  //stop criterion: 4/5 last responses are incorrect
  if (
    (arr.length == maxLength && arr.reduce((sum, current) => sum + current, 0) <= stopCriterion) ||
    (store.session.get('currentCorpus').length === 0 && store.session.get('currentCorpusName') === 'remaining')
  ) {
    store.session.set('endBlock', true);
  }
};

export const endGame = (arr, stopCriterion, maxLength) => {
  // end game if
  // 1. block is done AND
  // 2. the final bonus block is done, for the main block this condition will always be true
  // end game will occur twice if there is a bonus problems section

  //when the end of lower items are reached append the checkResponses to response tracker
  if (store.session.get('currentCorpusName') === 'lower' && store.session.get('currentCorpus').length === 0) {
    let checkResponses = store.session.get('checkResponseTracker');
    for (let i = 0; i < checkResponses.length; i++) {
      addResponse(checkResponses[i], store.session.get('responseWindowSize'));
    }
    arr = store.session.get('responseTracker');
    store.session.set('checkResponseTracker', []);
  }

  //check is block is done
  checkEndBlock(arr, stopCriterion, maxLength);

  if (store.session.get('endBlock') && store.session.get('bonusSkills').length === store.session.get('bonusIdx')) {
    //compute the grade estimates for subskills and composite
    computeAllGradeEstimates();
    store.session.set('endGame', true);
  }
};

const initSkill = (scores, subtask) => {
  scores[subtask] = {
    totalIncorrectBelow: 0,
    totalAttemptedBelow: 0,
    flag: false,
  };
};

//originally was <=66% correct OR 2 or more incorrect, but this is equivalent
//   0,   1,   2,   3,   4,   5
//1: 0%
//2: 0%, 50%
//3: 0%, 33%, 66%
//4: 0%, 25%, 50%,
//5: 0%, 20%, 40%, 60%
//6: 0%, 17%, 33%, 50%, 66%
//7: 0%, 14%, 28%, 42%, 57%, **71%
export const updateSkillScores = (correct, stimulus) => {
  let grade = store.session.get('cc_grade');

  //add skill for items below the student's grade level
  if (stimulus.b_grade < grade) {
    let scores = store.session.get('skillScores');
    for (let i = 0; i < stimulus['skill'].length; i++) {
      let skill = stimulus['skill'][i];
      if (!Object.hasOwn(scores, skill)) {
        //initialise the skill category scores
        initSkill(scores, skill);
      }
      if (correct === 0) {
        scores[skill].totalIncorrectBelow = scores[skill].totalIncorrectBelow + 1;
      }

      scores[skill].totalAttemptedBelow = scores[skill].totalAttemptedBelow + 1;
      if (
        (scores[skill].totalAttemptedBelow <= 3 && scores[skill].totalIncorrectBelow > 0) ||
        (scores[skill].totalAttemptedBelow > 3 && scores[skill].totalIncorrectBelow > 1)
      ) {
        scores[skill].flag = true;
      } else {
        scores[skill].flag = false;
      }
    }
    store.session.set('skillScores', scores);
  }
};

export const scaleTheta = (theta) => {
  let hyperParams = store.session.get('hyperParams');
  return theta * hyperParams['scale'] + hyperParams['shift'];
};
