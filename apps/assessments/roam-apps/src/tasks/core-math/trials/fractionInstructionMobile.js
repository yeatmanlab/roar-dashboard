import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import i18next from 'i18next';
import store from 'store2';
// import {SimpleKeyboard} from 'simple-keyboard';
import { isMobile } from './trialHelpers';
//import "simple-keyboard/build/css/index.css";

let rt = [];
let key = [];
let textboxVal = [];
//let startTime;
//let finalRT;
//let textbox_value = null;
let source;

/*const storeKeyRT = (keyName) => {
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
};*/

// Fixed item, displays instructions for fraction problems
const fractionInstructionTrial = (corpusName, assessment_stage_val) => {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => {
      let currentItem = store.session.get('nextStimulus');
      //let questionHTML = `<p>` + currentItem.item + `</p>`;
      let responseHTML = ``;
      //questionHTML = `<div class="question-box">` + questionHTML + `</div>`;

      responseHTML =
        `<div class="response-horizontal">
                  <p class="fraction-instruction">` +
        currentItem.lead[0] +
        `</p>
                  <div class="fraction-practice">
                      <input type="text" name="demo_0" id="demo_key_0" value="${currentItem.demoNumbers[0]}" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
        currentItem.textbox_width +
        `vw;" disabled>
                      <hr>
                      <input type="text" name="demo_1" id="demo_key_1" value="${currentItem.demoNumbers[1]}" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
        currentItem.textbox_width +
        `vw;" disabled>
                  </div>
                  <p class="fraction-instruction">` +
        currentItem.lead[1] +
        `</p>
                  <div class="fraction-practice">
                      
                    <div name="question_input_0" id="question_input_key_0" class="response-box-mobile fraction-practice-textbox" style="width: ` +
        currentItem.textbox_width +
        `vw;" tabindex="0"></div>
                      <hr>
                      <div name="question_input_1" id="question_input_key_1" class="response-box-mobile fraction-practice-textbox" style="width: ` +
        currentItem.textbox_width +
        `vw;" tabindex="0"></div>
                  </div>
              </div>`;

      return (
        `<div class="jspsych-content-modified instructions-bg">
            <div class="containerMobile">
                <div class="item-stimulus-simple-keyboard">
                    <div class="row column-flex">
                        <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                            <p class="instructions-text">` +
        currentItem.item +
        `<br><br>${i18next.t('instructions.core-math.text21')}
                            </p>
                        </div>
                        <div class="textbox-response" id="panel2">
                            <div class="item-stimulus-long">` +
        responseHTML +
        `</div>
                        </div>

                    </div>
                </div>
                <div class="simple-keyboard" id="simple-keyboard"></div>  
            </div>
        </div>`
      );
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = [];
      //startTime = performance.now(); //get initial time
    },
    on_load: () => {
      // let currentIdx = 0;
      let currentInput = document.getElementById('question_input_key_0');
      currentInput.classList.add('focused');

      let elements = document.getElementsByClassName('katex');
      // Loop through the elements and change the font size
      for (let i = 0; i < elements.length; i++) {
        elements[i].style.fontSize = '3.5vh';
      }

      // const decimalKey = store.session.get('decimalKey');

      /*const keyboard = new SimpleKeyboard({
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

      document.querySelectorAll('.response-box-mobile').forEach((el) => {
        el.addEventListener('click', () => {
          if (currentInput) currentInput.classList.remove('focused');
          currentInput = el;
          currentInput.classList.add('focused');
          currentIdx = [...document.querySelectorAll('.response-box-mobile')].indexOf(currentInput);
        });
      });

      function onChange(input) {
        if (currentIdx >= 0) {
          textboxVal[currentIdx] = document.getElementById('question_input_key_' + currentIdx).textContent;
        }
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
        const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(mediaAssets.audio.coreMathFractionInstruction);

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
      let response_val = [];
      let correctCount = 0;

      for (let i = 0; i < textboxVal.length; i++) {
        let response;
        let target = Number(stimulus.target[i]);
        if (Object.hasOwn(textboxVal, i)) {
          response = Number(textboxVal[i]);
          if (textboxVal[i] === null || textboxVal[i] === '') {
            response = '';
          }
        } else {
          response = '';
        }
        response_val.push(response);
        if (response === target) {
          correctCount++;
        }
      }

      let correct = correctCount === stimulus.target.length ? 1 : 0;

      store.session.set('dataCorrect', correct);

      if (corpusName === 'stimulus') {
        store.session.set('previousItem', stimulus);
        store.session.set('previousAnswer', store.session.get('dataCorrect'));
      }

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
        pid: store.session.get('config').pid,
        corpus_name: 'fractionInstruction',
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
        target: stimulus.target,
        response_key_list: key,
        response_time_list: rt,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        is_mobile: isMobile,
      });
      store.session.set('fractionInstructionDone', true);
    },
  };
};

const feedbackIncorrect = (corpusName, assessment_stage_val) => {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => {
      let currentItem = store.session.get('nextStimulus');
      //let questionHTML = `<p>` + currentItem.item + `</p>`;
      let responseHTML = ``;
      //questionHTML = `<div class="question-box">` + questionHTML + `</div>`;

      responseHTML =
        `<div class="response-horizontal">
                  <p class="fraction-instruction">` +
        currentItem.lead[0] +
        `</p>
                  <div class="fraction-practice">
                      <input type="text" name="demo_0" id="demo_key_0" value="${currentItem.demoNumbers[0]}" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
        currentItem.textbox_width +
        `vw;" disabled>
                      <hr>
                      <input type="text" name="demo_1" id="demo_key_1" value="${currentItem.demoNumbers[1]}" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
        currentItem.textbox_width +
        `vw;" disabled>
                  </div>
                  <p class="fraction-instruction">` +
        currentItem.lead[1] +
        `</p>
                  <div class="fraction-practice">
                      
                    <div name="question_input_0" id="question_input_key_0" class="response-box-mobile fraction-practice-textbox" style="width: ` +
        currentItem.textbox_width +
        `vw;" tabindex="0"></div>
                      <hr>
                      <div name="question_input_1" id="question_input_key_1" class="response-box-mobile fraction-practice-textbox" style="width: ` +
        currentItem.textbox_width +
        `vw;" tabindex="0"></div>
                  </div>
              </div>`;

      return (
        `<div class="jspsych-content-modified instructions-bg">
            <div class="containerMobile">
                <div class="item-stimulus-simple-keyboard">
                    <div class="row column-flex">
                        <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                            <p class="instructions-text">` +
        currentItem.item +
        `<br><br>${i18next.t('instructions.core-math.text21')}
                            </p>
                        </div>
                        <div class="textbox-response" id="panel2">
                            <div class="item-stimulus-long">` +
        responseHTML +
        `<p class="fraction-feedback">
                                <span class="red">
                                ${i18next.t('instructions.fluency.text12')}
                                </span>
                            </p>
                            </div>
                        </div>

                    </div>
                </div>
                <div class="simple-keyboard" id="simple-keyboard"></div>  
            </div>
        </div>`
      );
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = [];
      //startTime = performance.now(); //get initial time
    },
    on_load: () => {
      //let currentIdx = 0;
      let currentInput = document.getElementById('question_input_key_0');
      currentInput.classList.add('focused');

      let elements = document.getElementsByClassName('katex');
      // Loop through the elements and change the font size
      for (let i = 0; i < elements.length; i++) {
        elements[i].style.fontSize = '3.5vh';
      }

      //const decimalKey = store.session.get('decimalKey');

      /*
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

      document.querySelectorAll('.response-box-mobile').forEach((el) => {
        el.addEventListener('click', () => {
          if (currentInput) currentInput.classList.remove('focused');
          currentInput = el;
          currentInput.classList.add('focused');
          currentIdx = [...document.querySelectorAll('.response-box-mobile')].indexOf(currentInput);
        });
      });

      function onChange(input) {
        if (currentIdx >= 0) {
          textboxVal[currentIdx] = document.getElementById('question_input_key_' + currentIdx).textContent;
        }
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
      let response_val = [];
      let correctCount = 0;

      for (let i = 0; i < textboxVal.length; i++) {
        let response;
        let target = Number(stimulus.target[i]);
        if (Object.hasOwn(textboxVal, i)) {
          response = Number(textboxVal[i]);
          if (textboxVal[i] === null || textboxVal[i] === '') {
            response = '';
          }
        } else {
          response = '';
        }
        response_val.push(response);
        if (response === target) {
          correctCount++;
        }
      }

      let correct = correctCount === stimulus.target.length ? 1 : 0;

      store.session.set('dataCorrect', correct);

      if (corpusName === 'stimulus') {
        store.session.set('previousItem', stimulus);
        store.session.set('previousAnswer', store.session.get('dataCorrect'));
      }

      store.session.transact('indexTrackingPractice', (oldVal) => oldVal + 1);

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
        pid: store.session.get('config').pid,
        corpus_name: 'fractionInstruction',
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
        target: stimulus.target,
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
    //let questionHTML = `<p>` + currentItem.item + `</p>`;
    let responseHTML = ``;
    //questionHTML = `<div class="question-box">` + questionHTML + `</div>`;

    responseHTML =
      `<div class="response-horizontal">
                  <p class="fraction-instruction">` +
      currentItem.lead[0] +
      `</p>
                  <div class="fraction-practice">
                      <input type="text" name="demo_0" id="demo_key_0" value="${currentItem.demoNumbers[0]}" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
      currentItem.textbox_width +
      `vw;" disabled>
                      <hr>
                      <input type="text" name="demo_1" id="demo_key_1" value="${currentItem.demoNumbers[1]}" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
      currentItem.textbox_width +
      `vw;" disabled>
                  </div>
                  <p class="fraction-instruction">` +
      currentItem.lead[1] +
      `</p>
                  <div class="fraction-practice">
                      
                    <div name="question_input_0" id="question_input_key_0" class="response-box-mobile fraction-practice-textbox" style="width: ` +
      currentItem.textbox_width +
      `vw;" tabindex="0">${currentItem.target[0]}</div>
                      <hr>
                      <div name="question_input_1" id="question_input_key_1" class="response-box-mobile fraction-practice-textbox" style="width: ` +
      currentItem.textbox_width +
      `vw;" tabindex="0">${currentItem.target[1]}</div>
                  </div>
              </div>`;

    return (
      `<div class="jspsych-content-modified instructions-bg">
            <div class="containerMobile">
                <div class="item-stimulus-simple-keyboard">
                    <div class="row column-flex">
                        <div class="instruction-boxes fade-in-1" style="flex-basis: 60%;" id="panel1">
                            <p class="instructions-text">` +
      currentItem.item +
      `<br><br>${i18next.t('instructions.core-math.text21')}
                            </p>
                        </div>
                        <div class="textbox-response" id="panel2">
                            <div class="item-stimulus-long">` +
      responseHTML +
      `<p class="fraction-feedback">
                                <span class="green">
                                ${i18next.t('instructions.fluency.text10')}
                                </span>
                            </p>
                            </div>
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
  on_load: () => {
    let elements = document.getElementsByClassName('katex');
    // Loop through the elements and change the font size
    for (let i = 0; i < elements.length; i++) {
      elements[i].style.fontSize = '3.5vh';
    }

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
    });*/
  },
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

export const fractionInstructionMobile = (corpusName, assessment_stage_val) => {
  return {
    timeline: [
      fractionInstructionTrial(corpusName, assessment_stage_val),
      ifIncorrect(corpusName, assessment_stage_val),
      ifCorrect,
    ],
  };
};
