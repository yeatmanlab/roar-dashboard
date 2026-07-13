/*
Defines the jspsych object for the task trial (practice or main). Includes the object which will control sound after response is given in main task.
Data of each trial will be saved in jspsych data on finish of trial. Some session data variables are updated.
*/

 
 
 
import store from 'store2'; //storing session data
import { jsPsych } from '../../taskSetup';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import jsPsychAudioKeyboardResponse from '@jspsych/plugin-audio-keyboard-response';
import { mediaAssets } from '../../..';
import i18next from 'i18next';

// Initialises timers
export const initBlock = (corpusName, responseMode) => {
  let stim = {
    type: jsPsychCallFunction,
    func: () => {
      // if this is the first trial in this block, we will: 1. set the timer; 2. update the corpus
      if (store.session.get('indexTracking') === -1) {
        let arrayIdx = store.session.get('arrayIdx');
        let block = store.session.get('blockOrder')[corpusName][arrayIdx];
        if (store.session.get('responseModality')) {
          block = responseMode + '_' + block;
        }

        // will end the block by setting timeOut to be true (used for timer)
        if (corpusName !== 'practice') {
          //set timeout for ending trials once 3 minutes have been exceeded
          const timerId = setTimeout(() => {
            store.session.set('timeOut', true);
            store.session.set('timeOutTime', performance.now());
          }, store.session.get('timerDuration')[arrayIdx]);
          store.session.set('timerId', timerId);

          //set an additional timeout for force exiting, to prevent page inactivity
          const timerForceId = setTimeout(
            () => {
              store.session.set('timeForceOut', true);
              jsPsych.finishTrial();
            },
            store.session.get('timerDuration')[arrayIdx] + store.session.get('timerForceQuit'),
          );
          store.session.set('timerForceId', timerForceId);
          if (store.session.get('startTimePB') == null) {
            let startTime = performance.now();
            store.session.set('startTimePB', startTime);
          }
        }
        let currentCorpus;
        //set then current corpus based on task index for response modality study
        //if (store.session.get("responseModality")) {
        currentCorpus = store.session.get('corpusAll')[store.session.get('taskIdx')][corpusName][block];
        /*} else {
          currentCorpus = store.session.get("corpusAll")[corpusName][block];
        }*/

        store.session.set('currentCorpus', currentCorpus);
        store.session.set('subCorpusName', block);

        //allows the first keypress in case there was no keypress before
        store.session.set('allowKeyUp', true);
      }
    },
  };
  return stim;
};

const blackScreen = {
  type: jsPsychAudioKeyboardResponse,
  stimulus: () => mediaAssets.audio.nullAudio,
  prompt: () => {
    return `<div class="blackBG"></div>`;
  },
  trial_duration: () => 200,
  response_ends_trial: () => false,
};

export const ifTimeoutFlash = {
  timeline: [blackScreen],
  conditional_function: () => {
    if (store.session.get('timeForceOut')) {
      return true;
    }
    return false;
  },
};

const initFact = (factsArr, fact, operand) => {
  factsArr[operand] = {
    numCorrect: 0,
    numIncorrect: 0,
    numAttempted: 0,
    percentCorrect: 0,
    factString: fact,
  };
};
const pushFact = (correct, factString) => {
  let factsArr = store.session.get('factsArr');
  //Extract the number from the factString
  let factNumber = factString.match(/\d+/) - 1;

  if (!(factNumber in factsArr) || factsArr[factNumber] === null) {
    //initialise the grade estimate object for the sub task
    initFact(factsArr, factString, factNumber);
  }

  factsArr[factNumber].numAttempted = factsArr[factNumber].numAttempted + 1;
  if (correct) {
    factsArr[factNumber].numCorrect = factsArr[factNumber].numCorrect + 1;
  } else {
    factsArr[factNumber].numIncorrect = factsArr[factNumber].numIncorrect + 1;
  }

  factsArr[factNumber].percentCorrect = factsArr[factNumber].numCorrect / factsArr[factNumber].numAttempted;
  store.session.set('factsArr', factsArr);
};

// Get the worst 3 facts:
// 1. first consider facts with 2 or more wrong: sort by percent correct, if percent correct is equal then sort by number in increasing order
// 2. then consider facts with 1 wrong: sort by the number in increasing order (percent correct is not considered)
const getWorstFacts = () => {
  let factsArr = store.session.get('factsArr');
  let worstFactsArr = [];
  let worstFact = 1; // don't add facts that are 100% correct
  let worstIdx = null;
  let lowestIdx = null; // set max idx to get the lowest index
  let count = store.session.get('worstFactsCount');
  let factsLength = factsArr.filter(() => true).length;

  factsArr.forEach((value) => {
    if (value !== null) {
      value.flag = false;
    }
  });

  //repeat 3 times
  for (let i = 0; i < count; i++) {
    if (factsLength === i) {
      break;
    } else {
      //first check based on percent correct and numIncorrect
      for (let j = factsArr.length - 1; j >= 0; j--) {
        //if index is empty then skip
        if (!factsArr[j]) continue;

        if (!factsArr[j].flag) {
          if (factsArr[j].numIncorrect === 1) {
            //update the lowest idx with just 1 incorrect
            lowestIdx = j;
          } else if (factsArr[j].numIncorrect > 1 && factsArr[j].percentCorrect <= worstFact) {
            //update if they got more than 1 incorrect and the percent correct is worse than current worst
            worstIdx = j;
            worstFact = factsArr[j].percentCorrect;
          }
        }
      }

      //if all remaining facts have 0 or 1 incorrect
      if (worstIdx === null && lowestIdx !== null) {
        //take the lowest index if worst index is null
        worstIdx = lowestIdx;
        lowestIdx = null;
      }

      if (worstIdx !== null) {
        worstFactsArr.push(factsArr[worstIdx].factString);
        factsArr[worstIdx].flag = true;
        //reset
        worstIdx = null;
        worstFact = 1;
      } else {
        break;
      }
    }
  }

  store.session.set('worstFacts', worstFactsArr);
  store.session.set('factsArr', factsArr);
};

const checkAndPushSkill = (skillArr, subtask, skill) => {
  //update the facts and remaining skills for multiplication and division
  let factNumber = skill.match(/\d+/) - 1;
  let assessedFacts = store.session.get('assessedFacts');
  let remSkills = store.session.get('remSkillsMultDiv');
  if (subtask === 'multiplication' || subtask === 'division') {
    if (skill.toLowerCase().includes(i18next.t('terms.mathFact'))) {
      if (!assessedFacts[subtask].includes(skill)) {
        assessedFacts[subtask][factNumber] = skill;
        store.session.set('assessedFacts', assessedFacts);
      }
    } else {
      if (!remSkills[subtask].includes(skill)) {
        remSkills[subtask].push(skill);
        store.session.set('remSkillsMultDiv', remSkills);
      }
    }
  }

  if (skillArr.hasOwnProperty(subtask)) {
    if (!skillArr[subtask].includes(skill)) {
      if (subtask === 'multiplication' || subtask === 'division') {
        //get the facts that have been assessed for that operation in sorted order
        let skillMultDiv = assessedFacts[subtask].filter((x) => x !== null && x !== undefined);
        //append the remaining skills
        skillMultDiv.push(...remSkills[subtask]);
        skillArr[subtask] = skillMultDiv;
      } else {
        skillArr[subtask].push(skill);
      }
    }
  } else {
    skillArr[subtask] = [skill];
  }
};

export const pushSkill = (correct, skill, subtask) => {
  let incorrectSkills = store.session.get('incorrectSkills');
  let assessedSkills = store.session.get('assessedSkills');
  for (let i = 0; i < skill.length; i++) {
    if (skill[i].toLowerCase().includes(i18next.t('terms.mathFact'))) {
      pushFact(correct, skill[i]);
    } else {
      if (!correct) {
        checkAndPushSkill(incorrectSkills, subtask, skill[i]);
      }
    }
    checkAndPushSkill(assessedSkills, subtask, skill[i]);
  }
  if (subtask === 'multiplication' || subtask === 'division') {
    getWorstFacts();
  }

  store.session.set('incorrectSkills', incorrectSkills);
  store.session.set('assessedSkills', assessedSkills);
};

export const reInitStore = () => {
  let stim = {
    type: jsPsychCallFunction,
    func: () => {
      store.session.transact('taskIdx', (oldVal) => oldVal + 1);
      jsPsych.setProgressBar(0); //reset progress bar
      store.session.set('timerId', null);
      store.session.set('timerForceId', null);
      store.session.set('nextStimulus', null);
      store.session.set('allowKeyUp', false);
      store.session.set('startTimePB', null);
      store.session.set(
        'totalTimePB',
        store.session.get('timerDuration').reduce((a, b) => a + b),
      );
      store.session.set('correctCount', 0);
      store.session.set('arrayIdx', 0);
    },
  };
  return stim;
};
