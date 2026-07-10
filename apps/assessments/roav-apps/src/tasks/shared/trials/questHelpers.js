import jsPsychCallFunction from '@jspsych/plugin-call-function';
import {
  QuestCreate,
  QuestUpdate,
  QuestQuantile,
  QuestMean,
  QuestSd,
  QuestMode,
  QuestPdf,
  QuestP,
  QuestBetaAnalysis,
  QuestBetaAnalysis1,
  QuestRecompute,
  QuestSimulate,
  QuestTrials,
} from 'jsquest';
import { AssessmentStage } from '../helpers/namingHelpers';

import { jsPsych } from '../helpers/taskSetup';
import { sessionGet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';

export const quest = {};

const paramsQuestDef = {
  tGuess: Math.log10(30), // 1.48
  tGuessSd: 0.5, // 0.3 - 0.8 is standard when contrast is in percentages
  pThreshold: 0.75,
  beta: 3.5,
  delta: 0.03, // standard is 0.01, making it higher for young subjects
  gamma: 0.5,
  grain: 0.01,
  range: 1.3,
  plotIt: false,
};

function wrapperAlertRedirect(arrAlerts, fn, ...args) {
  // if no window, call directly
  if (typeof window === 'undefined' || typeof window.alert !== 'function') {
    return fn(...args);
  }

  const alertOriginal = window.alert;

  window.alert = (msg) => {
    arrAlerts.push(`${fn.name}: ${msg}`);
  };

  try {
    return fn(...args);
  } finally {
    window.alert = alertOriginal;
  }
}

export const createQuest = (params = paramsQuestDef) => {
  const arrAlerts = [];

  let qstObj = wrapperAlertRedirect(
    arrAlerts,
    QuestCreate,
    params.tGuess,
    params.tGuessSd,
    params.pThreshold,
    params.beta,
    params.delta,
    params.gamma,
    params.grain,
    params.range,
    params.plotIt,
  );

  return {
    isQuestTrialFirst: true,
    params: params,
    getAlerts: () => arrAlerts.slice(),
    clearAlerts: () => {
      arrAlerts.length = 0;
    },
    addAlert: (msg) => {
      arrAlerts.push(msg);
    },
    qst: () => qstObj,
    quantile: (quantileOrder = 0.5) => wrapperAlertRedirect(arrAlerts, QuestQuantile, qstObj, quantileOrder),
    update: (intensity, response) => {
      qstObj = wrapperAlertRedirect(arrAlerts, QuestUpdate, qstObj, intensity, response);
    },
    mean: () => wrapperAlertRedirect(arrAlerts, QuestMean, qstObj),
    sd: () => wrapperAlertRedirect(arrAlerts, QuestSd, qstObj),
    mode: () => wrapperAlertRedirect(arrAlerts, QuestMode, qstObj),
    pdf: (intensity) => wrapperAlertRedirect(arrAlerts, QuestPdf, qstObj, intensity),
    psychFunction: (intensity) => wrapperAlertRedirect(arrAlerts, QuestP, qstObj, intensity),
    betaAnalysis: () => wrapperAlertRedirect(arrAlerts, QuestBetaAnalysis, qstObj),
    betaAnalysis1: () => wrapperAlertRedirect(arrAlerts, QuestBetaAnalysis1, qstObj),
    trials: (binSize) => wrapperAlertRedirect(arrAlerts, QuestTrials, qstObj, binSize),
    recompute: (plotIt, width, height) => {
      qstObj = wrapperAlertRedirect(arrAlerts, QuestRecompute, qstObj, plotIt, width, height);
    },
    simulate: (tTest, tActual, plotIt, width, height) =>
      wrapperAlertRedirect(arrAlerts, QuestSimulate, qstObj, tTest, tActual, plotIt, width, height),
  };
};

export const t_createQuest = (paramsIn = {}) => {
  const params = { ...paramsQuestDef, ...paramsIn };
  return {
    type: jsPsychCallFunction,
    func: () => {
      Object.assign(quest, createQuest(params));
    },
    on_finish: () => {
      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        assessment_stage: AssessmentStage.DATA,
        correct: true,
        type_trial: 'create-quest',
        id_trial: 'create-quest',
        pid: sessionGet(SK.CONFIG).pid,
        quest_params: params,
      });
    },
  };
};
