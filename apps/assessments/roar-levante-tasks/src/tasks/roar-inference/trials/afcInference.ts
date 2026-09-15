import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
// @ts-ignore
import { jsPsych, scaleTheta, clowder } from '../../taskSetup';
import {
  setSkipCurrentBlock,
  PageStateHandler,
  setSentryContext,
  shouldUseClowder,
  checkMaxTimeExceeded,
  getIrtEstimates,
  getTrialIrtEstimates,
  getItemParameters,
  CLOWDER_IRT_HYPERPARAMS,
  //@ts-ignore
} from '../../shared/helpers';
import { camelize } from '../../shared/helpers/camelize';
import _toNumber from 'lodash/toNumber';
// @ts-ignore
import { finishExperiment } from '../../shared/trials';
import type { LayoutConfigTypeInference } from '../types/inferenceTypes';
import { taskStore } from '../../../taskStore';
import type { ClowderZetaItem, ValidityEvaluator } from '../../shared/types/catTypes';
// Previously chosen responses for current practice trial
let practiceResponses = [];
let trialsOfCurrentType = 0;
let keyboardFeedbackHandler: (ev: KeyboardEvent) => void;
const incorrectPracticeResponses: Array<string | null> = [];

const handleStaggeredButtons = async (layoutConfig: LayoutConfigTypeInference, pageState: PageStateHandler) => {
  if (layoutConfig?.isStaggered) {
    const parentResponseDiv = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
    const stimulusDuration = await pageState.getStimulusDurationMs();

    // Disable the replay button till this animation is finished
    setTimeout(() => {
      pageState.disableReplayBtn();
    }, stimulusDuration + 110);

    for (const jsResponseEl of parentResponseDiv.children) {
      // disable the buttons so that they are not active during the animation
      jsResponseEl.classList.add(
        'lev-staggered-responses',
        'lev-staggered-disabled',
        'lev-staggered-grayscale',
        'lev-staggered-opacity',
      );
    }
  }
};

const getPromptTemplate = (prompt: string, story?: string | null, useStimText?: boolean) => {
  let template = '';
  if (prompt && !useStimText) {
    template += `
      <div class="lev-row-container instruction">
        <p>${prompt}</p>
      </div>
    `;
  }
  if (prompt && useStimText) {
    template += `
      <div class="lev-row-container instruction-no-border">
        <p>${story}</p>
      </div>
      <div class="lev-row-container roar-instruction-question">
        <p>${prompt}</p>
      </div>
    `;
  }
  template += '</div>';
  return template;
};

function getPrompt(layoutConfigMap: Record<string, LayoutConfigTypeInference>) {
  // showItem itemIsImage
  const stim = taskStore().nextStimulus;
  const t = taskStore().translations;

  const itemLayoutConfig = layoutConfigMap?.[stim.itemId];

  if (itemLayoutConfig) {
    const {
      prompt: { enabled: promptEnabled, useStimText: useStimText },
      story,
      stimText: stimulusTextConfig,
    } = itemLayoutConfig;
    let prompt = '';
    if (promptEnabled && useStimText) {
      prompt = stimulusTextConfig?.value ?? '';
    }
    return getPromptTemplate(prompt, story, useStimText);
  }
}

function getButtonChoices(layoutConfigMap: Record<string, LayoutConfigTypeInference>) {
  const stimulus = taskStore().nextStimulus;
  const itemLayoutConfig = layoutConfigMap?.[stimulus.itemId];
  if (itemLayoutConfig) {
    const {
      response: { values: buttonChoices },
    } = itemLayoutConfig;
    return buttonChoices;
  }
}

function getButtonHtml(layoutConfigMap: Record<string, LayoutConfigTypeInference>) {
  const stimulus = taskStore().nextStimulus;
  const isPracticeTrial = stimulus.assessmentStage === 'practice_response';
  const itemLayoutConfig = layoutConfigMap?.[stimulus.itemId];
  if (itemLayoutConfig) {
    const classList = [...itemLayoutConfig.classOverrides.buttonClassList];
    // TODO: Remove once we have a way to handle practive btns
    if (isPracticeTrial) {
      classList.push('practice-btn');
    }
    return `
      <button class='${classList.join(' ')}'>%choice%</button>
    `;
  }
}

function enableBtns(btnElements: NodeListOf<HTMLButtonElement>) {
  btnElements.forEach((btn) => (btn.disabled = false));
}

function handlePracticeButtonPress(
  btn: HTMLButtonElement,
  stim: StimulusType,
  practiceBtns: NodeListOf<HTMLButtonElement>,
  isKeyBoardResponse: boolean,
  responsevalue: string | number,
  itemConfig: LayoutConfigType,
) {
  const index = Array.prototype.indexOf.call(practiceBtns, btn);
  const choices = itemConfig.response?.values || [];
  const choice = choices[index];
  // const choice = btn?.children?.length ? (btn.children[0] as HTMLImageElement).alt : btn.textContent;
  const isCorrectChoice = choice?.toString() === stim.answer?.toString();
  if (isCorrectChoice) {
    btn.classList.add('success-shadow');
    setTimeout(
      () =>
        jsPsych.finishTrial({
          response: choice,
          incorrectPracticeResponses,
          button_response: !isKeyBoardResponse ? responsevalue : null,
          keyboard_response: isKeyBoardResponse ? responsevalue : null,
        }),
      1000,
    );
  } else {
    btn.classList.add('error-shadow');
    // jspysch disables the buttons for some reason, so re-enable them
    setTimeout(() => enableBtns(practiceBtns), 500);
    incorrectPracticeResponses.push(choice);
  }
}

function doOnLoad(layoutConfigMap: Record<string, LayoutConfigTypeInference>) {
  const stim = taskStore().nextStimulus as StimulusType;
  const itemLayoutConfig = layoutConfigMap?.[stim.itemId];
  const playAudioOnLoad = itemLayoutConfig?.playAudioOnLoad;
  const pageStateHandler = new PageStateHandler(stim.audioFile, playAudioOnLoad); // this falls to nullAudio
  const isPracticeTrial = stim.assessmentStage === 'practice_response';
  const isInstructionTrial = stim.trialType === 'instructions';
  // Handle the staggered buttons
  handleStaggeredButtons(itemLayoutConfig, pageStateHandler);
  // Setup Sentry Context
  setSentryContext({
    itemId: stim.itemId,
    taskName: stim.task,
    pageContext: 'afcInference',
  });

  if (isPracticeTrial) {
    const practiceBtns: NodeListOf<HTMLButtonElement> = document.querySelectorAll('.practice-btn');

    practiceBtns.forEach((btn, i) =>
      btn.addEventListener('click', async (e) => {
        handlePracticeButtonPress(btn, stim, practiceBtns, false, i, itemLayoutConfig);
      }),
    );
  }

  if (!isPracticeTrial && !isInstructionTrial) {
    trialsOfCurrentType += 1;
  }

  if (itemLayoutConfig?.classOverrides.stimulusContainerClassList.includes('inference-scroll')) {
    const jsPsychContent = document.querySelector('.jspsych-content') as HTMLElement;

    jsPsychContent?.classList.add('inference-scroll');
  }

  if (stim.trialType !== 'instructions') {
    const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
    const { buttonLayout } = taskStore();

    if (itemLayoutConfig) {
      if (buttonLayout === 'diamond') {
        // have to do it in the runtime
        buttonContainer.classList.add('lev-response-row-diamond-layout');
      } else {
        buttonContainer.classList.add(...itemLayoutConfig.classOverrides.buttonContainerClassList);
      }
    }

    // update the trial number
    taskStore.transact('trialNumSubtask', (oldVal: number) => oldVal + 1);
    // update total real trials
    if (isPracticeTrial) {
      taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
    }
  }
}

function doOnFinish(
  data: any,
  task: string,
  layoutConfigMap: Record<string, LayoutConfigTypeInference>,
  validityEvaluator?: ValidityEvaluator,
) {
  // note: nextStimulus is actually the current stimulus
  const stimulus = taskStore().nextStimulus;
  const itemLayoutConfig = layoutConfigMap?.[stimulus.itemId];
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

      responseIndex = data.button_response;
      responseValue = response.values[responseIndex];
      target = response.target;
      data.correct = responseValue === target;
    }

    // check response and record it
    const responseType = 'mouse';

    // Unnormed variants (scoringVersion < 1 or undefined/null)
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

    if (shouldUseClowder() && !stimulus.assessmentStage?.includes('instruction')) {
      taskStore('previousItem', stimulus);
      taskStore('previousAnswer', data.correct ? 1 : 0);
      const stimulusCats = stimulus.zetas.map((zeta: ClowderZetaItem) => zeta.cats[0]);

      // Only report response time and accuracy for composite trials
      if (validityEvaluator && !stimulus.assessmentStage?.includes('practice') && stimulusCats.includes('composite')) {
        validityEvaluator.addResponseData(data.rt, data.button_response, data.correct ? 1 : 0);
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

    const storyId = stimulus.itemId.split('_')[0];

    jsPsych.data.addDataToLastTrial({
      // specific to this trial
      story: stimulus.item,
      item: stimulus.prompt,
      answer: target,
      distractors: stimulus.distractors,
      corpusTrialType: stimulus.trialType,
      responseType,
      responseLocation: responseIndex,
      itemId: stimulus.origItemNum,
      corpusId: taskStore().corpus,
      storyId,
    });

    // Adding this seperately or otherwise it will overide
    // the response value added from practice trials
    if (stimulus.assessmentStage !== 'practice_response') {
      jsPsych.data.addDataToLastTrial({
        response: responseValue,
      });
    }
  } else {
    // instructions
    taskStore('numIncorrect', 0); // reset incorrect trial count
    jsPsych.data.addDataToLastTrial({
      // false because it's not a real trial
      correct: false,
    });
  }

  // Allow early termination for non-Clowder tasks
  if (!shouldUseClowder()) {
    if (itemLayoutConfig.inCorrectTrialConfig.onIncorrectTrial === 'skip') {
      setSkipCurrentBlock(stimulus.trialType);
    } else if (taskStore().numIncorrect >= taskStore().maxIncorrect) {
      finishExperiment();
    }
  }
  document.querySelector('.jspsych-content')?.classList.remove('inference-scroll');
}

export interface AfcStimulusInput {
  responseAllowed: boolean;
  promptAboveButtons: boolean;
  task: string;
  layoutConfigMap: Record<string, LayoutConfigTypeInference>;
  validityEvaluator?: ValidityEvaluator;
}

export const afcStimulusInference = ({
  responseAllowed,
  promptAboveButtons,
  task,
  layoutConfigMap,
  validityEvaluator,
}: AfcStimulusInput) => {
  return {
    type: jsPsychHtmlMultiResponse,
    response_allowed_while_playing: responseAllowed,
    data: () => {
      const stim = taskStore().nextStimulus;
      const isPracticeTrial = stim.assessmentStage === 'practice_response';
      return {
        // not camelCase because firekit
        save_trial: true,
        assessment_stage: stim.assessmentStage,
        // not for firekit
        isPracticeTrial: isPracticeTrial,
      };
    },
    stimulus: () => getPrompt(layoutConfigMap),
    prompt_above_buttons: promptAboveButtons,
    button_choices: () => getButtonChoices(layoutConfigMap),
    button_html: () => getButtonHtml(layoutConfigMap),
    on_load: () => doOnLoad(layoutConfigMap),
    on_finish: (data: any) => doOnFinish(data, task, layoutConfigMap, validityEvaluator),
    response_ends_trial: () => (taskStore().nextStimulus.assessmentStage === 'practice_response' ? false : true),
  };
};
