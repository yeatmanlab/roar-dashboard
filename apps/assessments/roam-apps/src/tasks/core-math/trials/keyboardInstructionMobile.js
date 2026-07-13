import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import i18next from 'i18next';
import store from 'store2';
// import { SimpleKeyboard } from 'simple-keyboard';
import { isMobile } from './trialHelpers';
//import "simple-keyboard/build/css/index.css";

let rt = [];
let key = [];
let textboxVal;
//let startTime;
let source;

/*
const storeKeyRT = (keyName) => {
  const endTime = performance.now();
  const response_time = Math.round(endTime - startTime);
  if (keyName === '{enter}') {
    key.push('Enter');
  } else if (keyName === '{bksp}') {
    key.push('Backspace');
  } else {
    key.push(keyName);
  }
  rt.push(response_time);
};
*/

const keyboardInstructionTrial = (corpusName, assessment_stage_val) => {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => {
      let currentItem = store.session.get('nextStimulus');
      return (
        `
          <div class="jspsych-content-modified instructions-bg">
              <div class="containerMobile">
                  <div class="item-stimulus-simple-keyboard">
                      <div class="row">
                          <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                              <p class="instructions-text">${currentItem.item_raw}</p>
                              <ol>
                              <li>${i18next.t('instructions.core-math.text17')}</li>
                              <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text18')}</li>
                              <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text19')}</li>
                              </ol>
                          </div>
                          <div class="textbox-response" style="width: 40vw;" id="panel2">
                              <p class="instructions-text">${i18next.t('instructions.core-math.text20')}</p>
                              <div name="practice_number" id="practice_number" class="response-box-mobile" style="text-align:center; width:` +
        currentItem.textbox_width +
        `vw;" tabindex="0"></div>
                          </div>

                      </div>
                  </div>
                  <div class="simple-keyboard" id="simple-keyboard"></div>  
              </div>
          </div>`
      );
    },

    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = null;
      //startTime = performance.now();
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_load: () => {
      let currentInput = document.getElementById('practice_number');
      currentInput.classList.add('focused');

      /*
      const decimalKey = store.session.get('decimalKey');

      const keyboard = new SimpleKeyboard({
        layout: {
          default: ['1 2 3 4 5 6 7 8 9 0', `{bksp} {empty} {empty} ${decimalKey} - {empty} {empty} {enter}`],
        },
        display: {
          '{bksp}': `${i18next.t('terms.delete')} <span class="big-symbol">\u232B</span>`,
          '{enter}': `${i18next.t('terms.submit')} <span class="big-symbol">\u2713</span>`,
          '{empty}': ' ', // Prevents rendering key value
        },
        onChange: (input) => onChange(input),
        onKeyPress: (button) => onKeyPress(button),
      });

      function onChange(input) {
        textboxVal = document.getElementById('practice_number').textContent;
      }

      function onKeyPress(button) {
        if (!currentInput) return;
        storeKeyRT(button);
        if (button === '{bksp}') {
          currentInput.textContent = currentInput.textContent.slice(0, -1);
        } else if (button === '{enter}') {
          jsPsych.finishTrial();
        } else {
          currentInput.textContent += button;
        }
      }*/

      async function replayAudio() {
        // pause audio
        if (source) {
          source.stop();
        }

        const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

        // Returns a promise of the AudioBuffer of the preloaded file path.
        const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(mediaAssets.audio.coreMathKeyboardInstruction);

        source = jsPsychAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(jsPsychAudioCtx.destination);
        source.start(0);
      }
      replayAudio();
    },
    on_finish: () => {
      // pause audio
      if (source) {
        source.stop();
      }

      let save_trial = true;
      const stimulus = store.session.get('nextStimulus');

      let response_val = Number(textboxVal);
      if (textboxVal === null || textboxVal === '') {
        response_val = '';
      }

      let correct = response_val === Number(stimulus.target[0]) ? 1 : 0;

      store.session.set('dataCorrect', correct);

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
        pid: store.session.get('config').pid,
        corpus_name: 'keyboardInstruction',
        trial_num_total: store.session.get('indexTrackingPractice') + 1,
        trial_num_block: store.session.get('indexTrackingPractice') + 1,
        item_id: stimulus.itemID,
        problem_id: null,
        problem_version: null,
        item_grade_level: null,
        theoretical_difficulty: null,
        choices: null,
        correct_response_num: null,
        choice_index: null,
        response: response_val,
        correct: store.session.get('dataCorrect'),
        item: stimulus.item_raw,
        target: stimulus.target[0],
        response_key_list: key,
        response_time_list: rt,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        is_mobile: isMobile,
      });
      store.session.set('keyboardInstructionDone', true);
    },
  };
};

const feedbackIncorrect = (corpusName, assessment_stage_val) => {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => {
      let currentItem = store.session.get('nextStimulus');
      return (
        `
          <div class="jspsych-content-modified instructions-bg">
              <div class="containerMobile">
                  <div class="item-stimulus-simple-keyboard">
                      <div class="row">
                          <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                              <p class="instructions-text">${currentItem.item_raw}</p>
                              <ol>
                              <li>${i18next.t('instructions.core-math.text17')}</li>
                              <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text18')}</li>
                              <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text19')}</li>
                              </ol> 
                          </div>
                          <div class="textbox-response" style="width: 40vw;" id="panel2">
                              <p class="instructions-text">${i18next.t('instructions.core-math.text20')}</p>
                              <div name="practice_number" id="practice_number" class="response-box-mobile" style="text-align:center; width:` +
        currentItem.textbox_width +
        `vw;" tabindex="0"></div>
                              <p class="feedback">
                                  <span class="red">
                                  ${i18next.t('instructions.fluency.text12')}
                                  </span>
                              </p>
                          </div>

                      </div>
                  </div>
                  <div class="simple-keyboard" id="simple-keyboard"></div>  
              </div>
          </div>`
      );
    },

    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = null;
      //startTime = performance.now();
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_load: () => {
      let currentInput = document.getElementById('practice_number');
      currentInput.classList.add('focused');

      /*
      const decimalKey = store.session.get('decimalKey');

      const keyboard = new SimpleKeyboard({
        layout: {
          default: ['1 2 3 4 5 6 7 8 9 0', `{bksp} {empty} {empty} ${decimalKey} - {empty} {empty} {enter}`],
        },
        display: {
          '{bksp}': `${i18next.t('terms.delete')} <span class="big-symbol">\u232B</span>`,
          '{enter}': `${i18next.t('terms.submit')} <span class="big-symbol">\u2713</span>`,
          '{empty}': ' ', // Prevents rendering key value
        },
        onChange: (input) => onChange(input),
        onKeyPress: (button) => onKeyPress(button),
      });

      function onChange(input) {
        textboxVal = document.getElementById('practice_number').textContent;
      }

      function onKeyPress(button) {
        if (!currentInput) return;
        storeKeyRT(button);
        if (button === '{bksp}') {
          currentInput.textContent = currentInput.textContent.slice(0, -1);
        } else if (button === '{enter}') {
          jsPsych.finishTrial();
        } else {
          currentInput.textContent += button;
        }
      }*/

      async function replayAudio() {
        // pause audio
        if (source) {
          source.stop();
        }

        const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

        // Returns a promise of the AudioBuffer of the preloaded file path.
        const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(mediaAssets.audio.coreMathFeedbackIncorrect);

        source = jsPsychAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(jsPsychAudioCtx.destination);
        source.start(0);
      }
      replayAudio();
    },
    on_finish: () => {
      // pause audio
      if (source) {
        source.stop();
      }

      let save_trial = true;
      const stimulus = store.session.get('nextStimulus');

      let response_val = Number(textboxVal);
      if (textboxVal === null || textboxVal === '') {
        response_val = '';
      }

      let correct = response_val === Number(stimulus.target[0]) ? 1 : 0;

      store.session.set('dataCorrect', correct);

      store.session.transact('indexTrackingPractice', (oldVal) => oldVal + 1);

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
        pid: store.session.get('config').pid,
        corpus_name: 'keyboardInstruction',
        trial_num_total: store.session.get('indexTrackingPractice') + 1,
        trial_num_block: store.session.get('indexTrackingPractice') + 1,
        item_id: stimulus.itemID,
        problem_id: null,
        problem_version: null,
        item_grade_level: null,
        theoretical_difficulty: null,
        choices: null,
        correct_response_num: null,
        choice_index: null,
        response: response_val,
        correct: store.session.get('dataCorrect'),
        item: stimulus.item_raw,
        target: stimulus.target[0],
        response_key_list: key,
        response_time_list: rt,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        is_mobile: isMobile,
      });
    },
  };
};

const feedbackCorrect = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.coreMathFeedbackCorrect;
  },
  prompt: () => {
    let currentItem = store.session.get('nextStimulus');
    return (
      `
        <div class="jspsych-content-modified instructions-bg">
            <div class="containerMobile">
                <div class="item-stimulus-simple-keyboard">
                    <div class="row">
                        <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                            <p class="instructions-text">${currentItem.item_raw}</p>
                            <ol>
                            <li>${i18next.t('instructions.core-math.text17')}</li>
                            <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text18')}</li>
                            <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text19')}</li>
                            </ol>
                        </div>
                        <div class="textbox-response" style="flex-basis: 40%;" id="panel2">
                            <p class="instructions-text">${i18next.t('instructions.core-math.text20')}</p>
                            <div name="practice_number" id="practice_number" class="response-box-mobile" style="text-align:center; width:` +
      currentItem.textbox_width +
      `vw;" tabindex="0">${currentItem.target[0]}</div>
                            <p class="feedback">
                                <span class="green">
                                ${i18next.t('instructions.fluency.text10')}
                                </span>
                            </p>
                        </div>

                    </div>
                </div>
                <div class="simple-keyboard" id="simple-keyboard"></div>  
            </div>
        </div>`
    );
  },
  keyboard_choices: () => [],
  button_choices: () => [''],
  response_ends_trial: true,
  trial_ends_after_audio: true,
  /*on_load: () => {
    const decimalKey = store.session.get('decimalKey');

    const keyboard = new SimpleKeyboard({
      layout: {
        default: ['1 2 3 4 5 6 7 8 9 0', `{bksp} {empty} {empty} ${decimalKey} - {empty} {empty} {enter}`],
      },
      display: {
        '{bksp}': `${i18next.t('terms.delete')} <span class="big-symbol">\u232B</span>`,
        '{enter}': `${i18next.t('terms.submit')} <span class="big-symbol">\u2713</span>`,
        '{empty}': ' ', // Prevents rendering key value
      },
    });
  },*/
};

const ifCorrect = {
  timeline: [feedbackCorrect],
  conditional_function: () => {
    if (store.session.get('dataCorrect') === 1) {
      return true;
    }
    return false;
  },
};

const ifIncorrect = (corpusName, assessment_stage_val) => {
  return {
    timeline: [feedbackIncorrect(corpusName, assessment_stage_val)],
    conditional_function: () => {
      if (store.session.get('dataCorrect') === 1) {
        return false;
      }
      return true;
    },
  };
};

export const keyboardInstructionMobile = (corpusName, assessment_stage_val) => {
  return {
    timeline: [
      keyboardInstructionTrial(corpusName, assessment_stage_val),
      ifIncorrect(corpusName, assessment_stage_val),
      ifCorrect,
    ],
  };
};
