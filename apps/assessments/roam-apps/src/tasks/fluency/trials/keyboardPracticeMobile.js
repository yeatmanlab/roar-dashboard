import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import i18next from 'i18next';
import store from 'store2';
//import { SimpleKeyboard } from 'simple-keyboard';
//import "simple-keyboard/build/css/index.css";

let rt = [];
let key = [];
let textboxVal;
//let startTime;
let source1, source2;

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

export const practiceStimulusMobile = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => {
    return `
        <div class="jspsych-content-modified instructions-bg">
            <h2 class="title">${i18next.t('instructions.text1')}</h2>
            <div class="containerMobile">
                <div class="item-stimulus-simple-keyboard">
                    <div class="row">
                        <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                            <ol>
                            <li>${i18next.t('instructions.core-math.text17')}</li>
                            <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text18')}</li>
                            <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text19')}</li>
                            </ol>
                        </div>
                        <div class="textbox-response" style="width: 40vw;" id="panel2">
                            <p class="instructions-text">${i18next.t('instructions.core-math.text20')}</p>
                            <div name="practice_number" id="practice_number" class="item-textbox-mobile" style="justify-content: center;" tabindex="0"></div>
                        </div>

                    </div>
                </div>
                <div class="simple-keyboard" id="simple-keyboard"></div>  
            </div>
        </div>`;
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
    assessment_stage: 'practice',
  },
  on_load: () => {
    let currentInput = document.getElementById('practice_number');
    currentInput.classList.add('focused');

    // Previous implementation using SimpleKeyboard library
    /*
      const keyboard = new SimpleKeyboard({
      layout: {
        default: ['1 2 3 4 5 6 7 8 9 0', '{bksp} {empty} {empty} {empty} {empty} {empty} {empty} {enter}'],
      },
      display: {
        '{bksp}': `${i18next.t('terms.delete')} <span class="big-symbol">\u232B</span>`,
        '{enter}': `${i18next.t('terms.submit')} <span class="big-symbol">\u2713</span>`,
        '{empty}': ' ', // Prevents rendering key value
      },
      onChange: (input) => onChange(input),
      onKeyPress: (button) => onKeyPress(button),
    });

    function onChange() {
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
    }
    */

    async function replayAudio() {
      // pause audio
      if (source2) {
        source2.stop();
      }

      const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

      // Returns a promise of the AudioBuffer of the preloaded file path.
      const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(mediaAssets.audio.instructionsFluencyPractice);

      source2 = jsPsychAudioCtx.createBufferSource();
      source2.buffer = audioBuffer;
      source2.connect(jsPsychAudioCtx.destination);
      source2.start(0);
    }
    replayAudio();
  },
  on_finish: () => {
    // pause audio
    if (source2) {
      source2.stop();
    }

    let response_val = Number(textboxVal);
    if (textboxVal === null || textboxVal === '') {
      response_val = '';
    }

    store.session.set('response', response_val);
    let correct = response_val === 10 ? 1 : 0;

    if (correct) {
      //store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
      store.session.set('practiceFeedback', 1); // if response = 1 then the participant got it correct
    } else {
      store.session.set('practiceFeedback', 0); // if response = 0 then the participant got it wrong
    }

    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      corpusName: 'example',
      pid: store.session.get('config').pid,
      trialNumBlock: store.session.get('keyboardPracticeCounter') + 1,
      target: '10',
      correct: store.session.get('practiceFeedback'),
      response: response_val,
      respTime: rt,
      keyPress: key,
    });
  },
};

export const feedbackIncorrectMobile = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => {
    return `
        <div class="jspsych-content-modified instructions-bg">
          <h2 class="title">${i18next.t('instructions.text1')}</h2>
            <div class="containerMobile">
                <div class="item-stimulus-simple-keyboard">
                    <div class="row">
                        <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                            <ol>
                            <li>${i18next.t('instructions.core-math.text17')}</li>
                            <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text18')}</li>
                            <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text19')}</li>
                            </ol> 
                        </div>
                        <div class="textbox-response" style="width: 40vw;" id="panel2">
                            <p class="instructions-text">${i18next.t('instructions.core-math.text20')}</p>
                            <div name="practice_number" id="practice_number" class="item-textbox-mobile" style="justify-content: center;" tabindex="0"></div>
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
        </div>`;
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
    assessment_stage: 'practice',
  },
  on_load: () => {
    let currentInput = document.getElementById('practice_number');
    currentInput.classList.add('focused');

    /*
    const keyboard = new SimpleKeyboard({
      layout: {
        default: ['1 2 3 4 5 6 7 8 9 0', '{bksp} {empty} {empty} {empty} {empty} {empty} {empty} {enter}'],
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
    }
    */

    async function replayAudio() {
      // pause audio
      if (source1) {
        source1.stop();
      }

      const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

      // Returns a promise of the AudioBuffer of the preloaded file path.
      const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(mediaAssets.audio.practiceFluencyIncorrect);

      source1 = jsPsychAudioCtx.createBufferSource();
      source1.buffer = audioBuffer;
      source1.connect(jsPsychAudioCtx.destination);
      source1.start(0);
    }
    replayAudio();
  },
  on_finish: () => {
    // pause audio
    if (source1) {
      source1.stop();
    }

    let response_val = Number(textboxVal);
    if (textboxVal === null || textboxVal === '') {
      response_val = '';
    }

    store.session.set('response', response_val);
    let correct = response_val === 10; //when csv is stored in bucket, targets are in string format

    if (correct) {
      //store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
      store.session.set('practiceFeedback', 1); // if response = 1 then the participant got it correct
    } else {
      store.session.set('practiceFeedback', 0); // if response = 0 then the participant got it wrong
    }

    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      corpusName: 'example',
      pid: store.session.get('config').pid,
      trialNumBlock: store.session.get('keyboardPracticeCounter') + 1,
      target: '10',
      correct: store.session.get('practiceFeedback'),
      response: response_val,
      respTime: rt,
      keyPress: key,
    });
  },
};

export const feedbackCorrectMobile = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.instructionsFluencyCorrect;
  },
  prompt: () => {
    return `
        <div class="jspsych-content-modified instructions-bg">
          <h2 class="title">${i18next.t('instructions.text1')}</h2>
            <div class="containerMobile">
                <div class="item-stimulus-simple-keyboard">
                    <div class="row">
                        <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                            <ol>
                            <li>${i18next.t('instructions.core-math.text17')}</li>
                            <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text18')}</li>
                            <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text19')}</li>
                            </ol>
                        </div>
                        <div class="textbox-response" style="flex-basis: 40%;" id="panel2">
                            <p class="instructions-text">${i18next.t('instructions.core-math.text20')}</p>
                            <div name="practice_number" id="practice_number" class="item-textbox-mobile" style="justify-content: center;" tabindex="0"></div>
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
        </div>`;
  },
  keyboard_choices: () => [],
  button_choices: () => [''],
  response_ends_trial: true,
  trial_ends_after_audio: true,
  on_load: () => {
    let currentInput = document.getElementById('practice_number');
    currentInput.innerText = store.session.get('response');

    /*
    const keyboard = new SimpleKeyboard({
      layout: {
        default: ['1 2 3 4 5 6 7 8 9 0', '{bksp} {empty} {empty} {empty} {empty} {empty} {empty} {enter}'],
      },
      display: {
        '{bksp}': `${i18next.t('terms.delete')} <span class="big-symbol">\u232B</span>`,
        '{enter}': `${i18next.t('terms.submit')} <span class="big-symbol">\u2713</span>`,
        '{empty}': ' ', // Prevents rendering key value
      },
    });
    */
  },
};
