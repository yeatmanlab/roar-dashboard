import { LETTER_SUBTASK_DOMAINS, PHONICS_SUBTASK_DOMAINS , LETTER_TASK_IDS, PHONICS_TASK_IDS } from '@roar-platform/assessment-schema/roar-letter';
import i18next from 'i18next';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import _isEmpty from 'lodash/isEmpty';
import _mapValues from 'lodash/mapValues';
import _omitBy from 'lodash/omitBy';
import { jsPsych } from '../jsPsych';
import { letterValidityEvaluator, mediaAssets } from '../experiment';
import {
  addItemToSortedStoreList,
  makeFinite,
  replayAudioStimulus,
  shuffle,
  updateProgressBar,
} from '../helperFunctions';
import { isPractice } from './subTask';
import { audioResponse } from './audioFeedback';
import { isMaxTimeoutReached } from './appTimer';
import { clowder, scaleTheta, setNextStimulus } from '../experimentSetup';
import { COMPOSITE_DOMAIN, AssessmentStage } from '@roar-platform/assessment-schema';

export const audioContext = new Audio();

const phonicsChanceThreshold = 25; // chance is 25 percent
const phonicsMinTrials = 20;

export const isEarlyStopReached = () => store.session.get('phonicsEarlyStop');

const prepareLetterChoices = (target, distractors) => {
  // randomly select a location for the correct answer
  const randIndex = Math.floor(Math.random() * (distractors.length + 1));

  // randomize the order of the distractors
  const stimulus = shuffle(distractors);
  const choices = [];
  for (let i = 0; i < distractors.length; i += 1) {
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

/**
 * Updates the correct and attempted counts for a specific phonics item group directly in session storage.
 * Each item group is stored as its own key, prepended with "phonicsGroup-".
 * For example, an item group "cvc" will be stored under the key "phonicsGroup-cvc".
 *
 * Current itemGroup values: cvc, digraph, i-blend, f-blend, r-ctrl, r-tri, silent-e, tri-blend, vt
 *
 * The data for each item group is stored as a JSON string representing an object:
 * { "correct": number, "attempted": number }
 *
 * @param {string} itemGroup - The phonics item group (e.g., "cvc", "digraph"). This will be appended to "phonicsGroup-" to form the key.
 * @param {0 | 1} correct - A value indicating if the attempt was correct (1) or incorrect (0).
 */
function updatePhonicsItemGroupStats(itemGroup, correct) {
  // Validate input
  if (typeof itemGroup !== 'string' || itemGroup.trim() === '') {
    console.warn("Invalid 'itemGroup' parameter. It must be a non-empty string.");
    return;
  }
  if (correct !== 0 && correct !== 1) {
    console.warn("Invalid 'correct' parameter. It must be 0 or 1.");
    return;
  }

  // Prepend "phonicsGroup-" to the itemGroup to form the key
  const itemGroupKey = `phonicsGroup-${itemGroup}`;
  const currentItemGroupDataString = store.session.get(itemGroupKey);
  let itemGroupData = { correct: 0, attempted: 0 };

  // Parse existing data, or use default if none exists
  if (currentItemGroupDataString) {
    try {
      itemGroupData = JSON.parse(currentItemGroupDataString);
    } catch (error) {
      console.error(`Error parsing data for item group '${itemGroup}':`, error);
      // If parsing fails, re-initialize to prevent further errors
      itemGroupData = { correct: 0, attempted: 0 };
    }
  }

  // Update counts
  itemGroupData.attempted += 1;
  if (correct === 1) {
    itemGroupData.correct += 1;
  }

  // Save updated data back to session storage
  store.session.set(itemGroupKey, JSON.stringify(itemGroupData));
}

/**
 * Retrieves the correct and attempted counts for a specific phonics item group directly from session storage.
 * The function expects the item group to be stored with "phonicsGroup-" prepended to its name.
 *
 * @param {string} itemGroup - The phonics item group to retrieve counts for. This will be appended to "phonicsGroup-" to form the key.
 * @returns {{correct: number, attempted: number}} An object containing the correct and attempted for the item group.
 * Returns { correct: 0, attempted: 0 } if the item group is not found or data is corrupted.
 */
export function getItemGroupStats(itemGroup) {
  if (typeof itemGroup !== 'string' || itemGroup.trim() === '') {
    console.warn("Invalid 'itemGroup' parameter. It must be a non-empty string.");
    return { correct: 0, attempted: 0 };
  }

  // Prepend "phonicsGroup-" to the itemGroup to form the key
  const itemGroupKey = `phonicsGroup-${itemGroup}`;
  const currentItemGroupDataString = store.session.get(itemGroupKey);

  // If no data exists for this item group, return default zeros
  if (!currentItemGroupDataString) {
    return { correct: 0, attempted: 0 };
  }

  try {
    const itemGroupData = JSON.parse(currentItemGroupDataString);
    if (_isEmpty(itemGroupData)) {
      return { correct: 0, attempted: 0 };
    }

    // Ensure the parsed data has the expected structure
    if (typeof itemGroupData.correct === 'number' && typeof itemGroupData.attempted === 'number') {
      return itemGroupData;
    }

    console.warn(`Data for item group '${itemGroup}' (key: '${itemGroupKey}') is malformed. Returning default counts.`);

    return { correct: 0, attempted: 0 };
  } catch (error) {
    console.error(`Error parsing data for item group '${itemGroup}' (key: '${itemGroupKey}'):`, error);
    // If parsing fails, return default zeros
    return { correct: 0, attempted: 0 };
  }
}

const letterNameTrials = {
  type: jsPsychAudioMultiResponse,
  response_allowed_while_playing: false,
  message_progress_bar: `${i18next.t('progressBar')}`,
  // inherit fields used in
  data: { save_trial: true },
  // play audio
  stimulus: () => {
    const stimulus = store.session.get('nextStimulus');
    const { task } = store.session.get('config');

    if (task === PHONICS_TASK_IDS.EN) {
      if (mediaAssets.audio[stimulus.audio_filename]) {
        return mediaAssets.audio[stimulus.audio_filename];
      }
      // if file is missing, play fail sound instead of crashing
      return mediaAssets.audio.fail;
    }
    return mediaAssets.audio[stimulus.audioFile];
  },

  on_load: () => {
    // update the trial number
    store.session.transact('trialNumSubtask', (oldVal) => oldVal + 1);

    // update total real trials
    const subTaskName = store.session('subTaskName');
    if (!isPractice(subTaskName)) {
      store.session.transact('trialNumTotal', (oldVal) => oldVal + 1);
    }

    // set up replay button
    document.getElementById('replay').addEventListener('click', replayAudioStimulus);
  },
  // replay button
  prompt: () => `<img id="replay" draggable="false" src="${mediaAssets.images.iconSpeaker}" alt="replay"/>`,
  trial_duration: () => store.session.get('config').timing.trialTime,

  // arrange letter stimuli
  button_choices: () => {
    // Expirement logic should not be happening in trial parameters
    const stimulus = store.session.get('nextStimulus');

    let target;
    if (store.session.get('config').task === PHONICS_TASK_IDS.EN) {
      target = stimulus.target_letter;
    } else {
      ({ target } = stimulus); // Destructuring in parentheses
    }
    const d1 = stimulus.distractor1;
    const d2 = stimulus.distractor2;
    const d3 = stimulus.distractor3;

    // use the target letter for the button
    const trialInfo = prepareLetterChoices(target, [d1, d2, d3]);

    store.session.set('target', target);
    store.session.set('correctResponseNum', trialInfo.correctResponseNum);
    store.session.set('choices', trialInfo.choices);

    return trialInfo.choices;
  },
  // display letter buttons
  button_html: () => '<button class="enable-btn">%choice%</button>',

  // check and store result
  on_finish: (data) => {
    // N.B.: nextStimulus is actually the current stimulus
    const currentStimulus = store.session.get('nextStimulus');
    const { zeta } = currentStimulus?.zetas?.find?.((zetaCatMap) => zetaCatMap.cats.includes(COMPOSITE_DOMAIN)) ?? {};
    const { a, b, c, d } = zeta ?? {};
    const itemParameters = { a, b, c, d };
    const choices = store.session('choices');

    // get subtask name
    const subTaskName = store.session('subTaskName');

    // check response and record it
    data.correct = data.button_response === store.session('correctResponseNum') ? 1 : 0;
    data.assessment_stage = isPractice(subTaskName) ? AssessmentStage.PRACTICE : AssessmentStage.TEST;
    store.session.set('correct', data.correct);
    store.session.set('response', data.button_response);
    store.session.set('responseValue', choices[data.button_response]);

    // Update engagement flags
    letterValidityEvaluator.addResponseData(data.rt, data.button_response, data.correct);

    // update running score and answer lists
    store.session.set('previousItem', currentStimulus);
    store.session.set('previousAnswer', data.correct);

    // Update theta and get next stimulus before writing trial data
    // Phonics uses cat.findNextItem() directly instead of clowder
    if (store.session.get('config').task !== PHONICS_TASK_IDS.EN) {
      setNextStimulus();
    }

    if (data.correct === 1) {
      addItemToSortedStoreList('correctItems', store.session('target'));
      store.session.transact('subtaskCorrect', (oldVal) => oldVal + 1);

      if (!isPractice(subTaskName)) {
        // practice trials don't count toward total
        store.session.transact('totalCorrect', (oldVal) => oldVal + 1);
      }
    } else {
      addItemToSortedStoreList('incorrectItems', store.session('target'));
    }

    const trialNumTotal = store.session.get('trialNumTotal');
    const totalPercentCorrect = Math.round((100 * store.session.get('totalCorrect')) / trialNumTotal);
    store.session.set('totalPercentCorrect', totalPercentCorrect);

    // check for early stop in phonics
    if (subTaskName === PHONICS_SUBTASK_DOMAINS.TEXT_SOUND_PSEUDO) {
      if (totalPercentCorrect < phonicsChanceThreshold && trialNumTotal > phonicsMinTrials) {
        store.session.set('phonicsEarlyStop', true);
      }
    }

    // update appropriate summary list
    const correctList = store.session('correctItems');
    const incorrectList = store.session('incorrectItems');
    if (subTaskName === LETTER_SUBTASK_DOMAINS.LOWERCASE_NAMES) {
      store.session.set('lowerCorrectItems', correctList);
      store.session.set('lowerIncorrectItems', incorrectList);
    } else if (subTaskName === LETTER_SUBTASK_DOMAINS.UPPERCASE_NAMES) {
      store.session.set('upperCorrectItems', correctList);
      store.session.set('upperIncorrectItems', incorrectList);
    } else if (subTaskName === LETTER_SUBTASK_DOMAINS.PHONEMES) {
      store.session.set('phonemeCorrectItems', correctList);
      store.session.set('phonemeIncorrectItems', incorrectList);
    } else if (subTaskName === PHONICS_SUBTASK_DOMAINS.TEXT_SOUND_PSEUDO) {
      // update count for phonics subscores
      const { itemGroup } = currentStimulus;
      updatePhonicsItemGroupStats(itemGroup, data.correct);
    }

    const { task, phonicsSet, taskId } = store.session.get('config');

    // save trial information
    const commonData = {
      // Common to all trials
      pid: store.session.get('config').pid,
      subtask: subTaskName,
      corpusId: currentStimulus.corpus_src,

      // Specific to this trial
      assessment_stage: isPractice(subTaskName) ? AssessmentStage.PRACTICE : AssessmentStage.TEST,
      target: store.session('target'),
      choices: store.session('choices'),
      responseValue: store.session('responseValue'),
      responseNum: data.button_response,
      correctResponseNum: store.session('correctResponseNum'),

      correct: data.correct,
      replay: store.session('ifReplay'),
      subtaskCorrect: store.session('subtaskCorrect'),
      totalCorrect: store.session('totalCorrect'),
      trialNumSubtask: store.session('trialNumSubtask'),
      trialNumTotal: store.session('trialNumTotal'),
    };

    if (taskId === LETTER_TASK_IDS.EN) {
      const thetaEstimateRaw = clowder.theta.composite;
      const thetaSERaw = makeFinite(clowder.seMeasurement.composite);
      const [thetaEstimate, thetaSE] = scaleTheta(thetaEstimateRaw, thetaSERaw);

      const thetas = _omitBy(
        {
          ...clowder.theta,
          scaled: thetaEstimate,
        },
        (value, key) => isPractice(key),
      );

      const thetaSEs = _mapValues(
        _omitBy(
          {
            ...clowder.seMeasurement,
            scaled: thetaSE,
          },
          (value, key) => isPractice(key),
        ),
        makeFinite,
      );

      if (!isPractice(subTaskName)) {
        Object.assign(commonData, {
          itemParameters,
          thetaEstimate: clowder.theta.composite,
          thetaSE: makeFinite(clowder.seMeasurement.composite),
          thetas,
          thetaSEs,
        });
      }

      Object.assign(commonData, {
        lowerCorrect: store.session('lowerCorrectItems'),
        lowerIncorrect: store.session('lowerIncorrectItems'),
        upperCorrect: store.session('upperCorrectItems'),
        upperIncorrect: store.session('upperIncorrectItems'),
        phonemeCorrect: store.session('phonemeCorrectItems'),
        phonemeIncorrect: store.session('phonemeIncorrectItems'),
      });
    } else if (task === PHONICS_TASK_IDS.EN) {
      const { itemGroup, itemId, pattern } = currentStimulus;

      Object.assign(commonData, {
        phonicsSet: phonicsSet,
        itemGroup: itemGroup,
        itemId: itemId,
        itemPattern: pattern,
      });
    }

    // Add the collected data to the last trial
    jsPsych.data.addDataToLastTrial(commonData);

    // reset the replay button
    store.session.set('ifReplay', 0);

    // progress bar
    if (!isPractice(subTaskName)) {
      updateProgressBar();
    }

    // log trial results for debugging
    // let temp = jsPsych.data.getLastTrialData();
  },
};

export const ifLetterNameTest = {
  timeline: [letterNameTrials],

  conditional_function: () => {
    // don't play if app timer expired
    if (isMaxTimeoutReached() || isEarlyStopReached()) {
      return false;
    }
    return true;
  },
};

export const ifRealTrialResponse = {
  timeline: [audioResponse],

  conditional_function: () => {
    // don't play if app timer expired
    if (isMaxTimeoutReached() || isEarlyStopReached()) {
      return false;
    }

    // doesn't apply to practice trials
    const subTaskName = store.session('subTaskName');
    return !isPractice(subTaskName);
  },
};
