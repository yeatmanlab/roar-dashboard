import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import {
  PageStateHandler,
  getParticipantUtilityButtonsHtml,
  setupReplayAudio,
  PageAudioHandler,
  camelize,
  handleStaggeredButtons,
  prepareChoices,
  addExperimenterButtons,
  setupFullscreenButton,
} from '../../shared/helpers';
import { generateImageChoices, handleButtonFeedback } from '../trials/stimulus';
import { jsPsych } from '../../taskSetup';
import { taskStore } from '../../../taskStore';

function enableOkBtn() {
  const okButton: HTMLButtonElement | null = document.querySelector('.primary');
  if (okButton != null) {
    okButton.disabled = false;
  }
}

const replayButtonHtmlId = 'replay-btn-revisited';

export const somethingSameDemo1 = {
  type: jsPsychHtmlMultiResponse,
  data: () => {
    return {
      assessment_stage: 'instructions',
    };
  },
  stimulus: () => {
    const prompt = 'sameDifferentSelectionBothYellowHeavy';
    const t = taskStore().translations;
    return `<div class="lev-stimulus-container">
          ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
          <div class="lev-row-container instruction">
            <p>${t[prompt]}</p>
          </div>
            <div class='lev-stim-content' style="flex-direction: column;">
                <div style="visibility: hidden";>
                  <button class='image-medium no-pointer-events'>
                    <img 
                      src=${mediaAssets.images[camelize('med-red-square')]}
                      alt=med-red-square
                      class=top-image
                    />
                  </button>
                </div>
              <div class='lev-response-row multi-4'>
                ${['lg-yellow-circle', 'sm-yellow-square']
                  .map((shape) => {
                    return `<button class='image-medium no-pointer-events' style='margin: 0 4px'>
                            <img 
                              src=${mediaAssets.images[camelize(shape)]} 
                              alt=${shape} 
                            />
                        </button>`;
                  })
                  .join('')}
              </div>
            </div>
        </div>`;
  },
  prompt_above_buttons: true,
  button_choices: ['OK'],
  button_html: () => {
    return `<button disabled class='primary'>OK</button>`;
  },
  response_ends_trial: true,
  post_trial_gap: 350,
  on_load: () => {
    const audioFile = 'sameDifferentSelectionBothYellowHeavy';

    const audioConfig: AudioConfigType = {
      restrictRepetition: {
        enabled: true,
        maxRepetitions: 2,
      },
      onEnded: enableOkBtn,
    };

    PageAudioHandler.playAudio(mediaAssets.audio[audioFile], audioConfig);

    const pageStateHandler = new PageStateHandler(audioFile, true);
    setupReplayAudio(pageStateHandler);
    addExperimenterButtons();
    setupFullscreenButton();
    const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
    buttonContainer.classList.add('lev-response-row');
    buttonContainer.classList.add('multi-4');
  },
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
    });
  },
};

export const somethingSameDemo2 = {
  type: jsPsychHtmlMultiResponse,
  data: () => {
    return {
      assessment_stage: 'instructions',
    };
  },
  stimulus: () => {
    const prompt = 'sdsPrompt3DemoHeavy';
    const t = taskStore().translations;
    return `<div class="lev-stimulus-container">
          ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
          <div class="lev-row-container instruction">
            <p>${t[prompt]}</p>
          </div>
            <div class='lev-stim-content' style="flex-direction: column;">
                <div>
                  <button class='image-medium no-pointer-events'>
                    <img 
                      src=${mediaAssets.images[camelize('med-red-square')]}
                      alt="med-red-square"
                      class='top-image'
                    />
                  </button>
                </div>
              <div class='lev-response-row multi-4'>
                ${['lg-yellow-circle', 'sm-yellow-square']
                  .map((shape) => {
                    return `<button class='image-medium no-pointer-events' style='margin: 0 4px'>
                            <img 
                              src=${mediaAssets.images[camelize(shape)]} 
                              alt=${shape} 
                            />
                        </button>`;
                  })
                  .join('')}
              </div>
            </div>
        </div>`;
  },
  prompt_above_buttons: true,
  button_choices: ['OK'],
  button_html: () => {
    return `<button class='primary' disabled>OK</button>`;
  },
  response_ends_trial: true,
  post_trial_gap: 350,
  on_load: () => {
    const pageStateHandler = new PageStateHandler('sdsPrompt3DemoHeavy', true);
    setupReplayAudio(pageStateHandler);
    addExperimenterButtons();
    setupFullscreenButton();
    const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
    buttonContainer.classList.add('lev-response-row');
    buttonContainer.classList.add('multi-4');

    const images: HTMLButtonElement[] = document.getElementsByClassName('image-medium') as any as HTMLButtonElement[];
    const topImage = images[0];
    const bottomImages = [images[1], images[2]];

    function animateTopButton() {
      topImage.style.animation = 'pulse 2s 1s';

      setTimeout(() => {
        enableOkBtn();
      }, 2500);
    }

    function animateBottomButtons() {
      bottomImages.forEach((button) => (button.style.animation = 'pulse 2s 1s'));

      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: true,
          maxRepetitions: 2,
        },
        onEnded: animateTopButton,
      };

      setTimeout(() => {
        PageAudioHandler.playAudio(mediaAssets.audio['sdsPrompt3DemoHeavyPart2'], audioConfig);
      }, 2500);
    }

    const audioConfig: AudioConfigType = {
      restrictRepetition: {
        enabled: true,
        maxRepetitions: 2,
      },
      onEnded: animateBottomButtons,
    };

    PageAudioHandler.playAudio(mediaAssets.audio['sdsPrompt3DemoHeavyPart1'], audioConfig);
  },
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
    });
  },
};

const videoInstructionData = [
  {
    prompt: 'sds-pick-square-demo-heavy',
    video: 'somethingSameDemo',
  },
  {
    prompt: 'sds-match-demo1-heavy',
    video: 'sdsMatchDemo1',
  },
  {
    prompt: 'sds-match-demo2-heavy',
    video: 'sdsMatchDemo2',
  },
];

const videoInstructions = videoInstructionData.map((data) => {
  return {
    type: jsPsychHtmlMultiResponse,
    data: () => {
      return {
        assessment_stage: 'instructions',
      };
    },
    stimulus: () => {
      const t = taskStore().translations;
      return `
        <div class="lev-stimulus-container">
          ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
          <div class="lev-row-container instruction">
            <p>${t[camelize(data.prompt)]}</p>
          </div>
          <video class="instruction-video" autoplay loop>
            <source src=${mediaAssets.video[data.video]} type="video/mp4"/>
            Your browser does not support the video tag.
          </video>
        </div>
      `;
    },
    prompt_above_buttons: true,
    post_trial_gap: 350,
    button_choices: ['Continue'],
    button_html: () => {
      const t = taskStore().translations;
      return `<button class="primary" disabled>${t.continueButtonText}</button>`;
    },
    keyboard_choices: 'NO_KEYS',
    on_load: () => {
      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: true,
          maxRepetitions: 2,
        },
        onEnded: enableOkBtn,
      };

      PageAudioHandler.playAudio(mediaAssets.audio[camelize(data.prompt)], audioConfig);

      const pageStateHandler = new PageStateHandler(data.prompt, true);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();
    },
    on_finish: () => {
      PageAudioHandler.stopAndDisconnectNode();

      jsPsych.data.addDataToLastTrial({
        audioButtonPresses: PageAudioHandler.replayPresses,
      });
    },
  };
});

export const matchDemo2 = videoInstructions.pop();
export const matchDemo1 = videoInstructions.pop();
export const somethingSameDemo3 = videoInstructions.pop();

const practiceData = [
  {
    audioFile: 'sameDifferentSelectionBothTrianglesHeavy',
    trialType: 'something-same-1',
    image: ['sm-blue-triangle', 'med-red-triangle'],
    answer: '',
    distractors: [],
    itemUid: 'sds-something-same-1-instr-heavy',
    itemId: 'sds-something-same-1-instr-heavy',
    correctAudio: '',
  },
  {
    audioFile: 'sdsPrompt3Heavy',
    trialType: 'something-same-2',
    image: ['lg-blue-circle'],
    answer: 'sm-blue-triangle',
    distractors: ['sm-blue-triangle', 'med-red-triangle'],
    itemUid: 'sds_same_',
    itemId: 'sds-something-same-1-test-heavy',
    correctAudio: 'sdsFeedbackBothBlue',
  },
  {
    audioFile: 'sameDifferentSelectionBothRedHeavy',
    trialType: 'something-same-1',
    image: ['lg-red-square', 'sm-red-triangle'],
    answer: '',
    distractors: [],
    itemUid: 'sds-something-same-2-instr-heavy',
    itemId: 'sds-something-same-2-instr-heavy',
    correctAudio: '',
  },
  {
    audioFile: 'sdsPrompt3Heavy',
    trialType: 'something-same-2',
    image: 'lg-yellow-circle',
    answer: 'lg-red-square',
    distractors: ['lg-red-square', 'sm-red-triangle'],
    itemUid: 'sds_same_',
    correctAudio: 'sdsFeedbackBothLarge',
  },
];

let startTime: number;
let incorrectPracticeResponses = [];

export const heavyPractice = practiceData.map((data) => {
  return {
    type: jsPsychHtmlMultiResponse,
    data: () => {
      return {
        save_trial: data.trialType === 'something-same-1',
        isPracticeTrial: true,
        itemId: data.itemId,
        assessment_stage: 'practice_response',
      };
    },
    stimulus: () => {
      let prompt = data.audioFile;

      const t = taskStore().translations;
      return `<div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <div class="lev-row-container instruction">
          <p>${t[prompt]}</p>
        </div>

        ${
          data.image && !Array.isArray(data.image)
            ? `<button class='image-medium' disabled>
            <img 
              src=${mediaAssets.images[camelize(data.image)]} 
              alt=${data.image}
            />
          </div>`
            : ''
        }
        
        ${
          data.image && Array.isArray(data.image)
            ? `<div class='lev-stim-content' style="flex-direction: column;">
            ${
              data.trialType === 'something-same-1'
                ? `
              <div style="visibility: hidden;">
                <button class='image-medium no-pointer-events'>
                  <img 
                    src=${mediaAssets.images[camelize(data.image[0])]} 
                    alt=${data.image[0]}
                    class='top-image'
                  />
                </button>
              </div>
              `
                : ''
            }
            <div class='lev-response-row multi-4'>
              ${(data.image as string[])
                .map((shape) => {
                  return `<button class='image-medium no-pointer-events' style='margin: 0 4px'>
                          <img 
                            src=${mediaAssets.images[camelize(shape)]} 
                            alt=${shape} 
                          />
                      </button>`;
                })
                .join('')}
            </div>
          </div>`
            : ''
        }
      </div>`;
    },
    prompt_above_buttons: true,
    post_trial_gap: 350,
    button_choices: () => {
      if (data.trialType === 'instructions' || data.trialType == 'something-same-1') {
        return ['OK'];
      } else {
        const randomize = !!data.answer ? 'yes' : 'no';
        // Randomize choices if there is an answer
        const { choices } = prepareChoices(data.answer, data.distractors, randomize);
        return generateImageChoices(choices);
      }
    },
    button_html: () => {
      const buttonClass =
        data.trialType === 'instructions' || data.trialType === 'something-same-1' ? 'primary' : 'image-medium';
      return `<button class="${buttonClass}">%choice%</button>`;
    },
    response_ends_trial: () => {
      return !(data.trialType === 'test-dimensions' || data.trialType !== 'something-same-1');
    },
    on_load: () => {
      startTime = performance.now();
      let audioFile = data.audioFile;

      PageAudioHandler.playAudio(mediaAssets.audio[audioFile]);

      const pageStateHandler = new PageStateHandler(audioFile, true);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();
      const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
      buttonContainer.classList.add('lev-response-row');
      buttonContainer.classList.add('multi-4');

      const trialType = data.trialType;

      // if the task is running in a cypress test, the correct answer should be indicated with 'correct' class
      if (window.Cypress && trialType !== 'something-same-1') {
        const responseBtns = document.querySelectorAll('.image-medium');
        responseBtns.forEach((button) => {
          const imgAlt = button.querySelector('img')?.getAttribute('alt');
          if (imgAlt === taskStore().nextStimulus.answer) {
            button.classList.add('correct');
          }
        });
      }

      if (data.trialType === 'something-same-2' && taskStore().heavyInstructions) {
        handleStaggeredButtons(pageStateHandler, buttonContainer, [
          'same-different-selection-highlight-1',
          'same-different-selection-highlight-2',
        ]);
      }

      if (trialType === 'something-same-2') {
        // cards should give feedback during test dimensions block
        const practiceBtns = Array.from(buttonContainer.children)
          .map((btnDiv) => btnDiv.firstChild)
          .filter((btn) => !!btn) as HTMLButtonElement[];

        practiceBtns.forEach((card, i) =>
          card.addEventListener('click', async (e) => {
            handleButtonFeedback(card, practiceBtns, false, i, data.correctAudio);
          }),
        );
      }
    },
    on_finish: (data: any) => {
      const choices = taskStore().choices;
      const endTime = performance.now();

      PageAudioHandler.stopAndDisconnectNode();

      jsPsych.data.addDataToLastTrial({
        audioButtonPresses: PageAudioHandler.replayPresses,
      });

      if (data.trialType !== 'something-same-2') {
        let isCorrect = incorrectPracticeResponses.length === 0;

        incorrectPracticeResponses = [];

        // update task store
        taskStore('isCorrect', isCorrect);

        const calculatedRt = Math.round(endTime - startTime);

        jsPsych.data.addDataToLastTrial({
          // specific to this trial
          item: data.item,
          answer: data.answer,
          correct: isCorrect,
          distractors: data.distractors,
          corpusTrialType: data.trialType,
          response: choices[data.button_response],
          responseLocation: data.button_response,
          rt: calculatedRt,
          audioFile: data.audioFile,
        });
      }
    },
  };
});
