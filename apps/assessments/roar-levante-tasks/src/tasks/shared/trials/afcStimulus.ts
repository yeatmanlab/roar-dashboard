// For all tasks except: H&F, Memory Game, Same Different Selection
import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import _toNumber from 'lodash/toNumber';
import { jsPsych, isTouchScreen, cat, scaleTheta, clowder } from '../../taskSetup';
import {
  getParticipantUtilityButtonsHtml,
  setupReplayAudio,
  setSkipCurrentBlock,
  PageAudioHandler,
  PageStateHandler,
  camelize,
  setSentryContext,
  handleStaggeredButtons,
  updateTheta,
  addPracticeButtonListeners,
  enableOkButton,
  shouldTerminateCat,
  selectNextSequentialTrial,
  addExperimenterButtons,
  setupFullscreenButton,
  addKeyboardListeners,
  addKeyIconHelpers,
  shouldUseClowder,
  checkMaxTimeExceeded,
  getIrtEstimates,
  getTrialIrtEstimates,
  getItemParameters,
  CLOWDER_IRT_HYPERPARAMS,
} from '../helpers';
import { mediaAssets } from '../../..';
import { finishExperiment } from '.';
import { taskStore } from '../../../taskStore';
import { displayDebugInfo } from '../helpers/displayDebugInfo';
import { getKeyboardChoices } from '../helpers/handleKeyboard';
import type { ClowderZetaItem, ValidityEvaluator } from '../types/catTypes';

const replayButtonHtmlId = 'replay-btn-revisited';
// Previously chosen responses for current practice trial
let practiceResponses = [];
let trialsOfCurrentType = 0;
let startTime: number;
let keyboardFeedbackHandler: (ev: KeyboardEvent) => void;
const incorrectPracticeResponses: Array<string | null> = [];

function getStimulus(layoutConfigMap: Record<string, LayoutConfigType>, trial?: StimulusType) {
  const stim = trial || taskStore().nextStimulus;
  const itemLayoutConfig = layoutConfigMap?.[stim.itemId];
  if (itemLayoutConfig) {
    const audioPath = itemLayoutConfig?.playAudioOnLoad ? camelize(stim.audioFile) : 'nullAudio';
    return mediaAssets.audio[audioPath];
  }
}

const getPromptTemplate = (
  prompt: string,
  mediaSrc: string | null,
  mediaAlt: string,
  stimText: string | null | undefined,
  equalSizeStim: boolean,
  stimulusContainerClassList: string[],
  promptClassList: string[],
) => {
  let template = '<div class="lev-stimulus-container">';

  template += getParticipantUtilityButtonsHtml(replayButtonHtmlId);

  if (prompt) {
    let containerClass = 'lev-row-container instruction';
    if (promptClassList) {
      containerClass = promptClassList.join(' ');
    }

    template += `
      <div class="${containerClass}">
        <p>${prompt}</p>
      </div>
    `;
  }
  if (mediaSrc || stimText) {
    let contentTemplate = '';
    if (mediaSrc) {
      contentTemplate += `
        <img 
          src=${mediaSrc}
          alt=${mediaAlt}
        />
      `;
    }

    if (stimText) {
      contentTemplate += `
        <p>${stimText}</p>
      `;
    }
    // TODO: Remove after LayoutConfig implementation
    let containerClass = equalSizeStim ? 'lev-stim-content' : 'lev-stim-content-x-3';
    if (stimulusContainerClassList) {
      containerClass = stimulusContainerClassList.join(' ');
    }
    template += `
      <div class=${containerClass}>
        ${contentTemplate}
      </div>
    `;
  }
  template += '</div>';
  return template;
};

function getPrompt(layoutConfigMap: Record<string, LayoutConfigType>, trial?: StimulusType) {
  // showItem itemIsImage
  const stim = trial || taskStore().nextStimulus;
  const t = taskStore().translations;
  const itemLayoutConfig = layoutConfigMap?.[stim.itemId];

  if (itemLayoutConfig) {
    const {
      prompt: { enabled: promptEnabled },
      classOverrides: { stimulusContainerClassList, promptClassList },
      equalSizeStim,
      showStimImage,
      stimText: stimulusTextConfig,
    } = itemLayoutConfig;
    const mediaAsset = stimulusTextConfig?.value
      ? mediaAssets.images[camelize(stimulusTextConfig.value)] || mediaAssets.images['blank']
      : null;
    const prompt = promptEnabled ? t[camelize(stim.audioFile)] : null;
    const mediaSrc = showStimImage ? mediaAsset : null;
    const mediaAlt = stimulusTextConfig?.value || `Image not loading: ${mediaSrc}. Please continue the task.`;
    const stimText = stimulusTextConfig ? stimulusTextConfig.displayValue : null;
    return getPromptTemplate(
      prompt,
      mediaSrc,
      mediaAlt,
      stimText,
      equalSizeStim,
      stimulusContainerClassList,
      promptClassList,
    );
  }
}

function generateImageChoices(choices: string[], target: string) {
  const practiceUrl =
    'https://imgs.search.brave.com/w5KWc-ehwDScllwJRMDt7-gTJcykNTicRzUahn6-gHg/rs:fit:860:0:0/g:ce/aHR0cHM6Ly9yZW5k/ZXIuZmluZWFydGFt/ZXJpY2EuY29tL2lt/YWdlcy9pbWFnZXMt/cHJvZmlsZS1mbG93/LzQwMC9pbWFnZXMt/bWVkaXVtLWxhcmdl/LTUvZmF0aGVyLWFu/ZC1kYXVnaHRlci1p/bi10aGUtb3V0ZXIt/YmFua3MtY2hyaXMt/d2Vpci5qcGc';
  return choices.map((choice) => {
    const imageUrl = mediaAssets.images[camelize(choice)] || practiceUrl;

    // if the task is running in a cypress test, the correct answer should be indicated with 'correct' class
    if (window.Cypress) {
      const isCorrect = choice === target;
      return isCorrect
        ? `<img src=${imageUrl} alt=${choice} class='correct'/>`
        : `<img src=${imageUrl} alt=${choice} />`;
    } else {
      return `<img src=${imageUrl} alt=${choice} />`;
    }
  });
}

function getButtonChoices(layoutConfigMap: Record<string, LayoutConfigType>, trial?: StimulusType) {
  const stimulus = trial || taskStore().nextStimulus;
  const itemLayoutConfig = layoutConfigMap?.[stimulus.itemId];
  const { response } = itemLayoutConfig;
  const target = response.target;
  if (itemLayoutConfig) {
    const {
      isImageButtonResponse,
      response: { displayValues: buttonChoices },
    } = itemLayoutConfig;
    if (isImageButtonResponse) {
      return generateImageChoices(buttonChoices, target);
    }
    return buttonChoices;
  }
}

function getButtonHtml(layoutConfigMap: Record<string, LayoutConfigType>, trial?: StimulusType) {
  const stimulus = trial || taskStore().nextStimulus;
  const isPracticeTrial = stimulus.assessmentStage === 'practice_response';
  const itemLayoutConfig = layoutConfigMap?.[stimulus.itemId];
  if (itemLayoutConfig) {
    const classList = [...itemLayoutConfig.classOverrides.buttonClassList];
    const disableOkButton = itemLayoutConfig.disableOkButton;
    // TODO: Remove once we have a way to handle practice btns
    if (isPracticeTrial) {
      classList.push('practice-btn');
    }
    return `
      <button class='${classList.join(' ')}' ${disableOkButton ? 'disabled' : ''}>%choice%</button>
    `;
  }
}

function doOnLoad(
  layoutConfigMap: Record<string, LayoutConfigType>,
  trial?: StimulusType,
  isKeyboardEnabled?: boolean,
) {
  const audioConfig: AudioConfigType = {
    restrictRepetition: {
      enabled: true,
      maxRepetitions: 2,
    },
    onEnded: () => {
      enableOkButton();
    },
  };

  // play trial audio
  PageAudioHandler.playAudio(getStimulus(layoutConfigMap, trial) || '', audioConfig);

  startTime = performance.now();

  const incorrectPracticeResponses: Array<string | null> = [];
  taskStore('incorrectPracticeResponses', incorrectPracticeResponses);

  const stim = trial || (taskStore().nextStimulus as StimulusType);
  const itemLayoutConfig = layoutConfigMap?.[stim.itemId];
  const playAudioOnLoad = itemLayoutConfig?.playAudioOnLoad;

  let pageStateHandler;
  if (typeof stim.audioFile === 'string') {
    // no need to handle array case since it's not supported yet
    pageStateHandler = new PageStateHandler(stim.audioFile, playAudioOnLoad);
  } else {
    throw new Error('Multiple audio files are not supported in this trial type');
  }
  const isPracticeTrial = stim.assessmentStage === 'practice_response';
  const isInstructionTrial = stim.trialType === 'instructions';

  if (itemLayoutConfig.isStaggered) {
    // Handle the staggered buttons
    const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
    const imgButtons = Array.from(buttonContainer.children as HTMLCollectionOf<HTMLButtonElement>);
    let audioKeys: string[] = [];
    for (let i = 0; i < imgButtons.length; i++) {
      const img = imgButtons[i].children[0].getElementsByTagName('img')[0];
      const audioKey = camelize(img?.alt ?? '');
      audioKeys.push(audioKey);
    }

    handleStaggeredButtons(pageStateHandler, buttonContainer, audioKeys);
  }

  const currentTrialIndex = jsPsych.getProgress().current_trial_global;
  let twoTrialsAgoIndex = currentTrialIndex - 2;

  // Setup Sentry Context
  setSentryContext({
    itemId: stim.itemId,
    taskName: stim.task,
    pageContext: 'afcStimulus',
  });

  if (stim.task === 'math') {
    twoTrialsAgoIndex = currentTrialIndex - 3; // math has a fixation or something

    // flag correct answers with alt text for math if running a Cypress test
    if (window.Cypress && !isInstructionTrial) {
      const choices: NodeListOf<HTMLButtonElement> = document.querySelectorAll('.secondary, .image-medium, .primary');
      choices[itemLayoutConfig.response.targetIndex].setAttribute('aria-label', 'correct');
    }
  }
  const twoTrialsAgoStimulus = jsPsych.data.get().filter({ trial_index: twoTrialsAgoIndex }).values();

  if (isPracticeTrial) {
    const answer = stim.answer.toString();
    const choices = layoutConfigMap?.[stim.itemId].response.values;

    if (taskStore().task === 'trog') {
      let feedbackHandler;
      feedbackHandler = addKeyboardListeners(stim, isTouchScreen, layoutConfigMap?.[stim.itemId]);

      if (feedbackHandler !== undefined) {
        keyboardFeedbackHandler = feedbackHandler;
      }
    } else {
      addPracticeButtonListeners(answer, isTouchScreen, choices);
    }
  }

  // should log trialsOfCurrentType - race condition
  if (stim.task === 'math') {
    if (twoTrialsAgoStimulus != undefined && stim.trialType === twoTrialsAgoStimulus[0]?.trialType) {
      trialsOfCurrentType += 1;
    } else {
      trialsOfCurrentType = 0;
    }
  } else {
    if (!isPracticeTrial && !isInstructionTrial) {
      trialsOfCurrentType += 1;
    }
  }

  if (stim.trialType !== 'instructions') {
    const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
    const responseButtons = buttonContainer.children as HTMLCollectionOf<HTMLButtonElement>;
    const totalResponseButtons = responseButtons.length;
    const { buttonLayout } = taskStore();

    if (itemLayoutConfig) {
      if (buttonLayout === 'diamond' && totalResponseButtons === 4) {
        // have to do it in the runtime
        buttonContainer.classList.add('lev-response-row-diamond-layout');
      } else {
        buttonContainer.classList.add(...itemLayoutConfig.classOverrides.buttonContainerClassList);
      }
    }
    if (isKeyboardEnabled) {
      Array.from(responseButtons).forEach((el, i) => {
        const keyIndex = totalResponseButtons === 2 ? i + 1 : i;
        addKeyIconHelpers(el, keyIndex);
      });
    }
    // update the trial number
    taskStore.transact('trialNumSubtask', (oldVal: number) => oldVal + 1);
  }

  setupReplayAudio(pageStateHandler);

  // display debug info if enabled
  displayDebugInfo(stim);

  addExperimenterButtons();
  setupFullscreenButton();
}

function doOnFinish(
  data: any,
  task: string,
  layoutConfigMap: Record<string, LayoutConfigType>,
  terminateCat: boolean,
  trial?: StimulusType,
  isKeyboardEnabled?: boolean,
  validityEvaluator?: ValidityEvaluator,
) {
  PageAudioHandler.stopAndDisconnectNode();

  if (taskStore().debug) {
    document.body.removeChild(document.querySelector('.theta-estimate-container') as Node);
  }

  // note: nextStimulus is actually the current stimulus
  const stimulus = trial || taskStore().nextStimulus;
  const itemLayoutConfig = layoutConfigMap?.[stimulus.itemId];
  const { runCat, corpus, isRoarApp } = taskStore();
  let responseValue = null;
  let target = null;
  let responseIndex = null;

  if (shouldUseClowder()) {
    checkMaxTimeExceeded(stimulus.audioFile);
  }

  if (stimulus.trialType !== 'instructions') {
    if (itemLayoutConfig) {
      const { response } = itemLayoutConfig;
      if (!response) {
        throw new Error('Choices not defined in the config');
      }
      const keyboardChoices = getKeyboardChoices(itemLayoutConfig);
      responseIndex =
        data.keyboard_response && isKeyboardEnabled
          ? keyboardChoices.findIndex((f) => f.toLowerCase() === data.keyboard_response.toLowerCase())
          : data.button_response;

      responseValue = response.values[responseIndex];
      target = response.target;
      data.correct = responseValue === target;
    }

    if (runCat) {
      updateTheta(stimulus, data.correct);
    }

    // TODO: detect touch input
    const responseType = 'mouse';

    // update running score and answer lists
    if (data.correct) {
      if (stimulus.assessmentStage !== 'practice_response') {
        // practice trials don't count toward total
        taskStore.transact('totalCorrect', (oldVal: number) => oldVal + 1);
        taskStore('numIncorrect', 0); // reset incorrect trial count
      }
      practiceResponses = [];
    } else {
      // Only increase incorrect trials if response is incorrect not a practice trial
      if (stimulus.assessmentStage !== 'practice_response') {
        taskStore.transact('numIncorrect', (oldVal: number) => oldVal + 1);
      }

      practiceResponses.push(responseValue);
    }

    jsPsych.data.addDataToLastTrial({
      // specific to this trial
      item: _toNumber(stimulus.item) || stimulus.item,
      answer: target,
      distractors: stimulus.distractors,
      corpusTrialType: stimulus.trialType,
      responseType,
      responseLocation: responseIndex,
      itemUid: stimulus.itemUid,
      audioFile: stimulus.audioFile,
      corpus: corpus,
    });

    // corpusId and itemId fields are used by ROAR but not ROAD
    if (taskStore().storeItemId) {
      jsPsych.data.addDataToLastTrial({
        corpusId: taskStore().corpusId,
        itemId: stimulus.itemId,
      });
    }

    // Adding this seperately or otherwise it will overide
    // the response value added from practice trials
    if (stimulus.assessmentStage !== 'practice_response') {
      jsPsych.data.addDataToLastTrial({
        response: responseValue,
      });
    }

    // adding manually since trial does not log it properly
    // for keyboard responses
    if (stimulus.assessmentStage === 'practice_response') {
      const endTime = performance.now();
      const calculatedRt = Math.round(endTime - startTime);
      jsPsych.data.addDataToLastTrial({
        rt: calculatedRt,
      });

      if (taskStore().task === 'trog') {
        document.removeEventListener('keydown', keyboardFeedbackHandler);
      }
    }
  } else {
    // instructions
    taskStore('numIncorrect', 0); // reset incorrect trial count
    jsPsych.data.addDataToLastTrial({
      // false because it's not a real trial
      correct: false,
    });
  }

  jsPsych.data.addDataToLastTrial({
    audioButtonPresses: PageAudioHandler.replayPresses,
  });

  if (stimulus.assessmentStage === 'test_response') {
    taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
  }

  if (!isRoarApp) {
    if (itemLayoutConfig.inCorrectTrialConfig.onIncorrectTrial === 'skip' && !runCat) {
      setSkipCurrentBlock(stimulus.trialType);
    } else if (taskStore().numIncorrect >= taskStore().maxIncorrect && !runCat) {
      finishExperiment();
    }

    if (terminateCat) {
      shouldTerminateCat();
    }

    if (itemLayoutConfig?.blockedTrials) {
      const nextTrials = taskStore().sequentialTrials.filter((trial: StimulusType) => {
        return trial.block_index === stimulus.block_index;
      });

      selectNextSequentialTrial(nextTrials);
    }
  } else if (shouldUseClowder() && !stimulus.assessmentStage?.includes('instruction')) {
    taskStore('previousItem', stimulus);
    taskStore('previousAnswer', data.correct ? 1 : 0);
    const stimulusCats = stimulus.zetas.map((zeta: ClowderZetaItem) => zeta.cats[0]);

    // Only report response time and accuracy for composite trials (excluding new items)
    if (taskStore().task === 'trog') {
      // If validityEvaluator does not exist, do not throw error to allow scores to be calculated
      if (validityEvaluator && !stimulus.assessmentStage?.includes('practice') && stimulusCats.includes('composite')) {
        validityEvaluator.addResponseData(
          data.rt,
          data.keyboard_response ? data.keyboard_response : data.button_response,
          data.correct ? 1 : 0,
        );
      }

      const { catsScaled } = CLOWDER_IRT_HYPERPARAMS[task][taskStore().scoringVersion];
      const irtEstimates = getIrtEstimates(clowder.theta, clowder.seMeasurement, scaleTheta, catsScaled);

      taskStore('irtEstimates', irtEstimates);

      // Add theta and thetaSe estimates to populate composite.test
      jsPsych.data.addDataToLastTrial({
        ...getItemParameters(stimulus),
        thetaEstimate: irtEstimates.composite?.thetaEstimate,
        thetaSE: irtEstimates.composite?.thetaSE,
      });

      jsPsych.data.write({
        ...getTrialIrtEstimates(irtEstimates),
      });
    }
  }
}

export const afcStimulusTemplate = (
  {
    responseAllowed,
    promptAboveButtons,
    task,
    layoutConfigMap,
    terminateCat,
    validityEvaluator,
  }: {
    responseAllowed: boolean;
    promptAboveButtons: boolean;
    task: string;
    layoutConfigMap: Record<string, LayoutConfigType>;
    terminateCat: boolean;
    validityEvaluator?: ValidityEvaluator;
  },
  trial?: StimulusType,
) => {
  const isKeyboardEnabled = taskStore().task === 'trog' && taskStore().isRoarApp;
  return {
    type: jsPsychHtmlMultiResponse,
    response_allowed_while_playing: responseAllowed,
    data: () => {
      const stim = trial || taskStore().nextStimulus;
      let isPracticeTrial = stim.assessmentStage === 'practice_response';
      return {
        // not camelCase because firekit
        save_trial: true,
        assessment_stage: stim.assessmentStage,
        // not for firekit
        isPracticeTrial: isPracticeTrial,
      };
    },
    stimulus: () => getPrompt(layoutConfigMap, trial),
    prompt_above_buttons: promptAboveButtons,
    keyboard_choices: () => {
      const stim = trial || taskStore().nextStimulus;

      const itemLayoutConfig = layoutConfigMap[stim.itemId];
      return isKeyboardEnabled ? getKeyboardChoices(itemLayoutConfig) : 'NO_KEYS';
    },
    button_choices: () => getButtonChoices(layoutConfigMap, trial),
    button_html: () => getButtonHtml(layoutConfigMap, trial),
    on_load: () => doOnLoad(layoutConfigMap, trial, isKeyboardEnabled),
    on_finish: (data: any) =>
      doOnFinish(data, task, layoutConfigMap, terminateCat, trial, isKeyboardEnabled, validityEvaluator),
    response_ends_trial: () => {
      const stim = trial || taskStore().nextStimulus;

      return stim.assessmentStage !== 'practice_response';
    },
  };
};
