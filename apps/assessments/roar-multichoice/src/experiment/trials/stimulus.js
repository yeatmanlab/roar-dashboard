import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
// import {itemId} from "../config/corpus"
import { jsPsych } from '../jsPsych';
import { shuffle, addItemToSortedStoreList, getPrompt, clampPositive } from '../helperFunctions';

import { multichoiceValidityEvaluator } from '../experiment';
import { mediaAssets, clowder, scaleTheta } from '../experimentSetup';
import { isPractice } from './subTask';
import { audioResponse } from './audioFeedback';
import { isMaxTimeoutReached, updateProgressBar } from './appTimer';

export const audioContext = new Audio();

const prepareSurveyChoices = (target, distractors) => {
  // randomly select a location for the correct answer
  const randIndex = Math.floor(Math.random() * (distractors.length + 1));

  // randomize the order of the distractors
  const stimulus = shuffle(distractors);
  let choices = [];
  for (let i = 0; i < distractors.length; i++) {
    choices.push(stimulus[i]);
  }

  // insert the target
  choices.splice(randIndex, 0, target);

  return {
    target: target,
    choices: choices,
    correctResponseNum: randIndex,
  };
};

const trialsMapped = [0, 1].map((i) => {
  const isPracticeTrial = i === 0;
  const assessmentStage = isPracticeTrial ? 'practice' : 'test';
  return {
    type: jsPsychAudioMultiResponse,
    response_allowed_while_playing: true,
    data: () => ({
      // Modify to use a function to dynamically set data
      save_trial: true,
      assessment_stage: assessmentStage,
    }),
    stimulus: mediaAssets.audio.nullAudio,
    prompt: () => getPrompt(),
    prompt_above_buttons: true,
    button_choices: () => {
      const stimulus = store.session.get('nextStimulus');

      // Handle case when no more items are available
      if (!stimulus) {
        return [];
      }

      const { target } = stimulus;
      const d1 = stimulus.distractor1;
      const d2 = stimulus.distractor2;
      const d3 = stimulus.distractor3;

      const trialInfo = prepareSurveyChoices(target, [d1, d2, d3]);

      store.session.set('target', target);
      store.session.set('correctResponseNum', trialInfo.correctResponseNum);
      store.session.set('choices', trialInfo.choices);

      return trialInfo.choices;
    },
    button_html: () => {
      return '<button>%choice%</button>';
    },
    on_load: () => {
      const btnOption = store.session.get('config').buttonLayout;
      document.getElementById('jspsych-audio-multi-response-btngroup').classList.add(`${btnOption}-layout`);

      if (store.session.get('config').task === 'cva') {
        document.getElementById('decorated').style.textDecoration = 'underline';
        document.getElementById('decorated').style.textDecorationThickness = '2px';
      }
    },
    on_finish: (data) => {
      const nextStimulus = store.session('nextStimulus');
      const choices = store.session('choices');
      const subTaskName = store.session('subTaskName');
      let totalPercentCorrect;

      data.correct = data.button_response === store.session('correctResponseNum') ? 1 : 0;
      store.session.set('correct', data.correct);
      store.session.set('response', data.button_response);
      store.session.set('responseValue', choices[data.button_response]);

      // Only increment trial counts if user actually responded
      if (data.button_response !== null && data.button_response !== undefined) {
        store.session.transact('trialNumSubtask', (oldVal) => oldVal + 1);
        if (!isPractice(subTaskName)) {
          store.session.transact('trialNumTotal', (oldVal) => oldVal + 1);
          store.session.transact('itemsCompleted', (oldVal) => (oldVal || 0) + 1);
        }
      }

      if (data.correct === 1) {
        if (!isPractice(subTaskName)) {
          store.session.set('previousItem', store.session.get('nextStimulus'));
          store.session.set('previousAnswer', data.correct);
          store.session.transact('totalCorrect', (oldVal) => oldVal + 1);
        }
      } else {
        store.session.set('previousItem', store.session.get('nextStimulus'));
        store.session.set('previousAnswer', 0);
        addItemToSortedStoreList('incorrectItems', store.session('target'));
      }

      totalPercentCorrect = Math.round((100 * store.session.get('totalCorrect')) / store.session.get('trialNumTotal'));
      store.session.set('totalPercentCorrect', totalPercentCorrect);

      // Update engagement flags - only for test responses, not practice
      if (assessmentStage === 'test' && store.session.get('catName') === 'core') {
        multichoiceValidityEvaluator.addResponseData(data.rt, data.button_response, data.correct);
      }

      let itemId;
      if ((nextStimulus.itemId === undefined || nextStimulus.itemId === null) && assessmentStage === 'practice') {
        itemId = 'practiceItem';
      } else {
        itemId = nextStimulus.itemId;
      }

      // Collect theta SEs from clowder
      const thetaComprehensionRaw = clowder?.theta?.composite_comprehension;
      const thetaSEComprehensionRaw = clampPositive(clowder?.seMeasurement?.composite_comprehension);
      const [, thetaSEScaled, , thetaSEScaledComprehension] = scaleTheta(
        thetaComprehensionRaw,
        thetaSEComprehensionRaw,
        thetaComprehensionRaw,
        thetaSEComprehensionRaw,
      );

      const thetaSEs = {
        core: clowder?.seMeasurement?.core,
        composite_comprehension: clampPositive(thetaSEScaledComprehension),
        scaled: clampPositive(thetaSEScaled),
      };

      let adaptiveTrialData = {};

      if (store.session('config').isAdaptive) {
        const zetas = store.session('nextStimulus')?.zetas ?? [];
        const catParameterPairs = [];
        zetas.forEach(({ cats, zeta }) => {
          for (const cat of cats) {
            catParameterPairs.push([cat, zeta]);
          }
        });
        const itemParameters = Object.fromEntries(catParameterPairs);

        adaptiveTrialData = {
          thetaSEs,
        };

        if (!isPractice(subTaskName)) {
          adaptiveTrialData.itemParameters = itemParameters;
        }
      }

      jsPsych.data.addDataToLastTrial({
        item: nextStimulus.item,
        itemId: itemId,
        assessment_stage: assessmentStage,
        target: store.session('target'),
        choices: store.session('choices'),
        decorated: nextStimulus.decorated,
        distractor1: nextStimulus.distractor1,
        distractor2: nextStimulus.distractor2,
        distractor3: nextStimulus.distractor3,
        corpusId: isPractice(subTaskName)
          ? store.session.get('config').practiceCorpus
          : store.session.get('config').stimulusCorpus,
        response: store.session('responseValue'),
        responseNum: data.button_response,
        correctResponseNum: store.session('correctResponseNum'),
        correct: data.correct,
        replay: store.session('ifReplay'),
        ...adaptiveTrialData,
      });
      store.session.set('ifReplay', 0);

      if (!isPractice(subTaskName)) {
        updateProgressBar();
      }
    },
  };
});

export const [practiceTrials, stimulusTrials] = trialsMapped;

// A single practice or stimulus trial, which will be skipped if AppTimer has expired

export const trialWrapped = (trialType = '') => {
  if (trialType === 'practice') {
    return {
      timeline: [practiceTrials],

      conditional_function: () => {
        // don't play when skipping trials because app is finished
        if (isMaxTimeoutReached()) return false;
      },
    };
  }
  if (trialType === 'stimulus') {
    return {
      timeline: [stimulusTrials],

      conditional_function: () => {
        // don't play when skipping trials because app is finished or no more items available
        if (isMaxTimeoutReached()) return false;

        // Check if no more items are available
        const nextStimulus = store.session.get('nextStimulus');
        return !!nextStimulus;
      },
    };
  }
};

export const ifRealTrialResponse = {
  timeline: [audioResponse],

  conditional_function: () => {
    // don't play when skipping trials because app is finished
    if (isMaxTimeoutReached()) return false;

    // don't play when no stimulus was shown (items exhausted)
    if (!store.session.get('nextStimulus')) return false;

    // doesn't apply to practice trials
    const subTaskName = store.session('subTaskName');
    if (isPractice(subTaskName)) {
      return false;
    }
    return true;
  },
};
