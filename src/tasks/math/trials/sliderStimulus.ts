import HTMLSliderResponse from '@jspsych/plugin-html-slider-response';
import _shuffle from 'lodash/shuffle';
import _toNumber from 'lodash/toNumber';
import _range from 'lodash/range';
import { jsPsych, isTouchScreen, cat } from '../../taskSetup';
//@ts-ignore
import { camelize } from '@bdelab/roar-utils';
import {
  addExperimenterButtons,
  setSkipCurrentBlock,
  getParticipantUtilityButtonsHtml,
  setupReplayAudio,
  PageAudioHandler,
  PageStateHandler,
  setSentryContext,
  updateTheta,
  addPracticeButtonListeners,
  shouldTerminateCat,
  setupFullscreenButton,
} from '../../shared/helpers';
import { mediaAssets } from '../../..';
import { taskStore } from '../../../taskStore';

let chosenAnswer: number;
let responseIdx: number;
let sliderStart: number;
let startTime: number;

function setUpAudio(cue: string) {
  const audioFile = mediaAssets.audio[camelize(cue)] || '';

  const audioConfig: AudioConfigType = {
    restrictRepetition: {
      enabled: true,
      maxRepetitions: 2,
    },
    onEnded: () => {
      // set up replay button audio after the first audio has played
      if (cue) {
        const pageStateHandler = new PageStateHandler(cue, true);
        setupReplayAudio(pageStateHandler);
        addExperimenterButtons();
        setupFullscreenButton();
      }
    },
  };

  PageAudioHandler.playAudio(audioFile, audioConfig);
}

function captureValue(
  btnElement: HTMLButtonElement | null,
  event: Event & { key?: string },
  i: number,
  isPractice: boolean,
  choice?: string,
) {
  chosenAnswer = choice ? _toNumber(choice) : _toNumber(btnElement?.textContent);
  responseIdx = i;

  if (!isPractice) {
    jsPsych.finishTrial();
  }
}

function getRandomValue(max: number, avoid: number, tolerance: number = 0.1) {
  const scaled_avoid = avoid / max;
  let result = Math.random();

  while (Math.abs(result - scaled_avoid) < tolerance) {
    result = Math.random();
  }

  return result * max;
}

export const slider = (
  layoutConfigMap: Record<string, LayoutConfigType>,
  terminateCat: boolean,
  trial?: StimulusType,
) => {
  return {
    type: HTMLSliderResponse,
    data: () => {
      return {
        save_trial: true,
        assessment_stage: (trial || taskStore().nextStimulus).assessmentStage,
        isPracticeTrial: (trial || taskStore().nextStimulus).assessmentStage === 'practice_response',
      };
    },
    stimulus: () => {
      const stim = trial || taskStore().nextStimulus;
      let t = taskStore().translations;

      const isSlider = stim.trialType === 'Number Line Slider';
      return `
      <div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml('replay-btn-revisited')}
          ${
            stim.trialType !== 'Number Line Buttons'
              ? `<div class="lev-row-container instruction">
                <p>
                  ${t[camelize(stim.audioFile)]}
                  ${isSlider ? '<br /> ' + stim.answer : ''}
                </p> 
              </div>`
              : ''
          }
      </div>
    `;
    },
    labels: () => (trial || taskStore().nextStimulus).item,
    // button_label: 'OK',
    require_movement: () => (trial || taskStore().nextStimulus).trialType === 'Number Line Slider',
    // slider_width: 800,
    min: () => (trial || taskStore().nextStimulus).item[0],
    max: () => (trial || taskStore().nextStimulus).item[1],
    // max: () => (taskStore().nextStimulus.item[1] === 1 ? 100 : taskStore().nextStimulus.item[1]),
    slider_start: () => {
      const stim = trial || taskStore().nextStimulus;

      if (stim.trialType.includes('Slider')) {
        // const max = stim.item[1] === 1 ? 100 : stim.item[1];
        const max = stim.item[1];
        sliderStart = getRandomValue(max, stim.answer);
      } else if (stim.trialType === 'Number Line 4afc') {
        sliderStart = stim.answer;
      } else {
        sliderStart = stim.item[1];
      }

      return sliderStart;
    },
    // step: 1,
    step: 'any',
    // add gap if it is a practice trial because setup trial will not be immediately after
    post_trial_gap: () => ((trial || taskStore().nextStimulus).assessmentStage === 'practice_response' ? 350 : 0),
    on_load: () => {
      startTime = performance.now();

      const stim = (trial || taskStore().nextStimulus) as StimulusType;
      const { distractors } = stim;
      const itemLayoutConfig = layoutConfigMap[stim.itemId];
      const incorrectPracticeResponses: Array<string | null> = [];
      taskStore('incorrectPracticeResponses', incorrectPracticeResponses);

      const slider = document.getElementById('jspsych-html-slider-response-response') as HTMLInputElement;
      const sliderLabels = document.getElementsByTagName('span') as HTMLCollectionOf<HTMLSpanElement>;
      Array.from(sliderLabels).forEach((el, i) => {
        //if (i == 1 || i == 2) {
        el.style.fontSize = '1.5rem';
        //}
      });
      const { buttonLayout } = taskStore();
      const isPractice = stim.assessmentStage === 'practice_response';
      const response = layoutConfigMap[stim.itemId].response;
      const answer = _toNumber(response.target);

      taskStore('target', answer);
      taskStore('choices', response.values);

      const responseChoices = response.values;

      // Setup Sentry Context
      setSentryContext({
        itemId: stim.itemId,
        taskName: stim.task,
        pageContext: 'sliderStimulus',
      });

      const wrapper = document.getElementById('jspsych-html-slider-response-wrapper') as HTMLDivElement;
      const responseRow = document.createElement('div');
      responseRow.style.display = 'flex';
      responseRow.style.justifyContent = 'center';
      responseRow.style.alignItems = 'center';
      const buttonContainer = document.createElement('div');
      const sliderContainer = document.getElementsByClassName(
        'jspsych-html-slider-response-container',
      )[0] as HTMLDivElement;

      if (buttonLayout === 'diamond' && response.values.length === 4) {
        // have to do it in the runtime
        buttonContainer.classList.add('lev-response-row-diamond-layout');
      } else {
        buttonContainer.classList.add(...itemLayoutConfig.classOverrides.buttonContainerClassList);
      }

      if (stim.trialType === 'Number Line 4afc') {
        // don't let participant move slider
        const progress = (Number(slider.value) * 100) / (Number(slider.max) - Number(slider.min));
        slider.classList.add('number-line-4afc-slider');
        slider.disabled = true;
        slider.style.background = `linear-gradient(to right, #275BDD ${progress}%, #edf0ed ${progress}%)`;

        wrapper.style.margin = '0 0 2rem 0';

        // disable continue button and make invisible
        const continueBtn = document.getElementById('jspsych-html-slider-response-next') as HTMLButtonElement;
        continueBtn.disabled = true;
        continueBtn.style.visibility = 'hidden';

        // create buttons
        for (let i = 0; i < responseChoices.length; i++) {
          const btnWrapper = document.createElement('div');
          btnWrapper.style.margin = '0px 8px';
          const btn = document.createElement('button');
          btn.textContent = responseChoices[i];

          // flag correct answer if running in cypress
          if (window.Cypress && _toNumber(btn.textContent) == answer) {
            btn.setAttribute('aria-label', 'correct');
          }

          btn.classList.add('secondary');
          if (stim.assessmentStage === 'practice_response') {
            btn.classList.add('practice-btn');
          }
          btn.addEventListener('click', (e) => captureValue(btn, e, i, isPractice));

          btnWrapper.appendChild(btn);
          buttonContainer.appendChild(btnWrapper);
        }
      } else if (stim.trialType === 'Number Line Slider') {
        const continueBtn = document.getElementById('jspsych-html-slider-response-next');
        if (continueBtn) {
          continueBtn.classList.add('primary');
        }

        const slider = document.getElementById('jspsych-html-slider-response-response') as HTMLButtonElement;

        slider.addEventListener('input', () => (chosenAnswer = Number(slider.value)));
      } else {
        // disable continue button and make invisible
        const continueBtn = document.getElementById('jspsych-html-slider-response-next') as HTMLButtonElement;
        continueBtn.disabled = true;
        continueBtn.style.visibility = 'hidden';

        // lower labels to give room for slider buttons
        const labels = sliderContainer.children[1].children as any as HTMLDivElement[];
        for (let i = 0; i < labels.length; i++) {
          labels[i].style.top = '50px';
        }

        // add slider styling
        const progress = (Number(slider.value) * 100) / (Number(slider.max) - Number(slider.min));
        slider.disabled = true;
        slider.style.background = `linear-gradient(to right, #275BDD ${progress}%, #edf0ed ${progress}%)`;
        slider.classList.add('number-line-buttons');

        // overlay response buttons on top of slider
        responseChoices.forEach((choice: any, i: number) => {
          const sliderButton = document.createElement('button');

          if (stim.assessmentStage === 'practice_response') {
            sliderButton.classList.add('practice-btn');
          }

          sliderButton.classList.add('slider');
          sliderButton.style.position = 'absolute';
          sliderButton.style.top = '-12px';

          const stepPercent = 100 / Number(slider.max);
          sliderButton.style.left = `calc(${stepPercent * Number(choice)}% - ${stepPercent / 2}%)`;

          sliderButton.addEventListener('click', (e) => captureValue(sliderButton, e, i, isPractice, choice));

          sliderContainer.appendChild(sliderButton);
        });
      }

      responseRow.appendChild(buttonContainer);
      wrapper.appendChild(responseRow);

      if (typeof stim.audioFile === 'string') {
        setUpAudio(stim.audioFile);
      } else {
        throw new Error('Multiple audio files are not supported in this trial type');
      }

      if (isPractice) {
        let feedbackHandler;
        const answer = stim.answer.toString();
        const choices = layoutConfigMap?.[stim.itemId].response.values;

        feedbackHandler = addPracticeButtonListeners(answer, isTouchScreen, choices);
      }
    },
    on_finish: (data: any) => {
      PageAudioHandler.stopAndDisconnectNode();

      const stimulus = trial || taskStore().nextStimulus;
      const isPractice = stimulus.assessmentStage === 'practice_response';
      const endTime = performance.now();
      const runCat = taskStore().runCat;

      const sliderScoringThreshold = 0.05; // proportion of maximum slider value that response must fall within to be scored correct
      if (stimulus.trialType === 'Number Line 4afc' || stimulus.trialType === 'Number Line Buttons') {
        if (isPractice) {
          data.correct = taskStore().incorrectPracticeResponses.length === 0;
        } else {
          data.correct = chosenAnswer === taskStore().target;
        }
      } else {
        data.correct = Math.abs(chosenAnswer - stimulus.answer) / stimulus.item[1] < sliderScoringThreshold;
      }

      // update taskStore
      taskStore('isCorrect', data.correct);

      if (!isPractice) {
        if (data.correct) {
          taskStore('numIncorrect', 0);
          taskStore.transact('totalCorrect', (oldVal: number) => oldVal + 1);
        } else {
          taskStore.transact('numIncorrect', (oldVal: number) => oldVal + 1);
        }

        if (runCat) {
          updateTheta(stimulus, data.correct);
        }
      }

      const response = chosenAnswer;
      const responseType = stimulus.trialType.includes('Slider')
        ? 'slider'
        : stimulus.trialType.includes('4afc')
        ? 'button'
        : 'slider-button';
      const answer = stimulus.answer;

      jsPsych.data.addDataToLastTrial({
        item: stimulus.item,
        answer: answer,
        response: _toNumber(response),
        responseType: responseType,
        distractors: stimulus.distractors,
        corpusTrialType: stimulus.trialType,
        // slider_start: stimulus.item[1] === 1 ? sliderStart / 100 : sliderStart,
        slider_start: sliderStart,
        audioButtonPresses: PageAudioHandler.replayPresses,
        itemUid: stimulus.itemUid,
        audioFile: stimulus.audioFile,
        corpus: taskStore().corpus,
      });

      if (taskStore().storeItemId) {
        jsPsych.data.addDataToLastTrial({
          itemId: stimulus.itemId,
        });
      }

      if (stimulus.assessmentStage === 'test_response') {
        taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
      }

      if (responseType === 'button' || responseType === 'slider-button') {
        const calculatedRt = Math.round(endTime - startTime);

        jsPsych.data.addDataToLastTrial({
          rt: calculatedRt,
          responseLocation: responseIdx,
        });
      }

      if (!runCat) {
        setSkipCurrentBlock(stimulus.trialType);
      }

      if (terminateCat) {
        shouldTerminateCat();
      }
    },
  };
};
