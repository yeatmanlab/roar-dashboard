/* eslint-disable import/no-cycle */
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import store from 'store2';
import { LETTER_SUBTASK_DOMAINS } from '@roar-platform/assessment-schema/roar-letter';

// order of subTasks
// note: subTaskName must be initialized to "" in config
// const getNextSubTask = (currentSubTask) => {

//   if (currentSubTask === "") {
//     return ("LetterPractice");
//   } else if (currentSubTask === "LetterPractice") {
//     return ("LowercaseNames");
//   } else if (currentSubTask === "LowercaseNames") {
//     return ("UppercaseNames");
//   } else if (currentSubTask === "UppercaseNames")  {
//     return ("PhonemePractice");
//   } else if (currentSubTask === "PhonemePractice")  {
//     return ("Phonemes");
//   } else {
//     return("");
//   }
// }

export const isPractice = () => {
  const currentSubTask = store.session.get('subTaskName');
  const practiceTasks = [
    LETTER_SUBTASK_DOMAINS.LETTER_PRACTICE,
    'PhonicsPractice',
    LETTER_SUBTASK_DOMAINS.PHONEME_PRACTICE,
  ];
  return practiceTasks.includes(currentSubTask);
};

// reset variables that are calculated per subtask
const subTaskInit = (name) => {
  store.session.set('subTaskName', name);
  store.session.set('trialNumSubtask', 0); // counter for trials in subtask
  store.session.set('subtaskCorrect', 0);
  store.session.set('correctItems', []);
  store.session.set('incorrectItems', []);
  return '';
};

export const getCurrentSubTaskSummary = () => {
  const subTaskSummary = {
    subtask: store.session('subTaskName'),
    subtaskCorrect: store.session('subtaskCorrect'),
    totalCorrect: store.session('totalCorrect'),
    correctList: store.session('correctItems'),
    incorrectList: store.session('incorrectItems'),
    trialNumSubtask: store.session('trialNumSubtask'),
    trialNumTotal: store.session('trialNumTotal'),
  };

  return subTaskSummary;
};

// wrap-up after the subtask is done
const subTaskFinish = () => {
  // log subtask results for debugging
  // const summary = getCurrentSubTaskSummary();
  // console.log(summary);
};

// trials to initialize each subtask
export const subTaskInitLowercase = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit(LETTER_SUBTASK_DOMAINS.LOWERCASE_NAMES);
  },
};

export const subTaskInitUppercase = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit(LETTER_SUBTASK_DOMAINS.UPPERCASE_NAMES);
  },
};

export const subTaskInitPhoneme = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit(LETTER_SUBTASK_DOMAINS.PHONEMES);
  },
};

export const subTaskInitLetterPractice = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit(LETTER_SUBTASK_DOMAINS.LETTER_PRACTICE);
  },
};

export const subTaskInitPhonemePractice = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit(LETTER_SUBTASK_DOMAINS.PHONEME_PRACTICE);
  },
};

export const subTaskInitPhonicsPractice = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit('PhonicsPractice');
  },
};

export const subTaskInitTextSoundPseudo = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit('TextSoundPseudo');
  },
};

export const subTaskComplete = {
  type: jsPsychCallFunction,
  func: subTaskFinish,
};
