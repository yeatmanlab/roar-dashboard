/* eslint-disable import/no-cycle */
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { jsPsych } from '../jsPsych';
import store from 'store2';

// order of subTasks
// note: subTaskName must be initialized to "" in config
const getNextSubTask = (currentSubTask) => {
  if (currentSubTask === '') {
    return 'LetterPractice';
  } else if (currentSubTask === 'LetterPractice') {
    return 'LowercaseNames';
  } else if (currentSubTask === 'LowercaseNames') {
    return 'UppercaseNames';
  } else if (currentSubTask === 'UppercaseNames') {
    return 'PhonemePractice';
  } else if (currentSubTask === 'PhonemePractice') {
    return 'Phonemes';
  } else {
    return '';
  }
};

export const isPractice = () => {
  const currentSubTask = store.session.get('subTaskName');
  if (currentSubTask === 'SurveyPractice') {
    return true;
  }
  return false;
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
  const summary = getCurrentSubTaskSummary();
};

// trials to initialize each subtask
export const subTaskInitSurvey = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit('Survey');
  },
};

export const subTaskInitSurveyPractice = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit('SurveyPractice');
  },
};

export const subTaskInitSurveyMain = {
  type: jsPsychCallFunction,
  func: function () {
    subTaskInit('SurveyMain');
  },
};

export const subTaskComplete = {
  type: jsPsychCallFunction,
  func: subTaskFinish,
};
