import jsPsychSurveyHtmlForm from '@jspsych/plugin-survey-html-form';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import i18next from 'i18next';
import store from 'store2';
import { isMobile } from './trialHelpers';

let rt = [];
let key = [];
let textboxVal = [];
let startTime;
//let finalRT;
//let textbox_value = null;
let source;

const storeKeyRT = (keyName) => {
  const endTime = performance.now();
  const response_time = Math.round(endTime - startTime);
  const name = keyName;
  key.push(name);
  rt.push(response_time);
};

// Fixed item, displays instructions for fraction problems
const fractionInstructionTrial = (corpusName, assessment_stage_val) => {
  return {
    type: jsPsychSurveyHtmlForm,
    html: () => {
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
                      <input type="text" name="question_input_0" id="question_input_key_0" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
        currentItem.textbox_width +
        `vw;">
                      <hr>
                      <input type="text" name="question_input_1" id="question_input_key_1" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
        currentItem.textbox_width +
        `vw;">
                  </div>
              </div>`;

      return (
        `<div class="jspsych-content-modified">
          
            <div class="row">
            <div class="instruction-boxes fade-in-1" style="width: 80vw;" id="panel1">
              <div class="text-image">
                <p style="font-size: 3vh; margin-right: 5vh;">` +
        currentItem.item +
        `<br><br>${i18next.t('instructions.core-math.text15')}
                </p>
                <img src="${mediaAssets.images.keyboardFraction}" alt="arrow keys" style="width: 30vw; padding: 2vh;">
              </div>
            </div>
          </div>
          <div class="item-stimulus-long">` +
        responseHTML +
        `</div>
          <img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>
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
      startTime = performance.now(); //get initial time
    },
    on_load: () => {
      document.getElementById('question_input_key_0').focus();

      let elements = document.getElementsByClassName('katex');
      // Loop through the elements and change the font size
      for (let i = 0; i < elements.length; i++) {
        elements[i].style.fontSize = '3.5vh';
      }

      //disable button to prevent double clicks
      const btn = document.getElementById('go-button-id');
      if (btn) {
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
          btn.style.pointerEvents = 'auto';
        }, 1000);
      }

      //hide the survey form submit button
      const submit_button = document.getElementById('jspsych-survey-html-form-next');
      submit_button.classList.add('hide-submit');

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

      //store the textbox value at each keypress
      document.getElementById('question_input_key_0').addEventListener('input', function () {
        textboxVal[0] = this.value;
      });
      document.getElementById('question_input_key_1').addEventListener('input', function () {
        textboxVal[1] = this.value;
      });

      document.getElementById('jspsych-survey-html-form').addEventListener('keydown', (event) => {
        //only permit numbers, backspace and enter key
        if (event.code === 'ArrowUp') {
          storeKeyRT(event.key);
          event.preventDefault(); // Prevent default behavior
          let element = document.getElementById('question_input_key_0');
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
          //element.setSelectionRange(0, 0);
        } else if (event.code === 'ArrowDown') {
          storeKeyRT(event.key);
          event.preventDefault(); // Prevent default behavior
          let element = document.getElementById('question_input_key_1');
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
          //element.setSelectionRange(0, 0);
        } else if (
          (!event.code.includes('Digit') || !isFinite(event.key)) &&
          event.code !== 'Backspace' &&
          event.code !== 'Enter'
        ) {
          //only allows numbers, backspace, minus, period, and enter
          event.preventDefault();
        } else {
          storeKeyRT(event.key);
        }
      });

      document.getElementById('go-button-id').addEventListener('click', function () {
        //so that key press is allowed at the start of next trial
        store.session.set('allowKeyUp', true);
        jsPsych.finishTrial();
      });
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
        if (textboxVal.hasOwn(i)) {
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
    type: jsPsychSurveyHtmlForm,
    html: () => {
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
                      <input type="text" name="question_input_0" id="question_input_key_0" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
        currentItem.textbox_width +
        `vw;">
                      <hr>
                      <input type="text" name="question_input_1" id="question_input_key_1" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
        currentItem.textbox_width +
        `vw;">
                  </div>
              </div>`;

      return (
        `<div class="jspsych-content-modified">
          
            <div class="row">
            <div class="instruction-boxes fade-in-1" style="width: 80vw;" id="panel1">
              <div class="text-image">
                <p style="font-size: 3vh; margin-right: 5vh;">` +
        currentItem.item +
        `<br><br>${i18next.t('instructions.core-math.text15')}
                </p>
                <img src="${mediaAssets.images.keyboardFraction}" alt="arrow keys" style="width: 30vw; padding: 2vh;">
              </div>
            </div>
          </div>
          <div class="item-stimulus-long">` +
        responseHTML +
        `<p class="fraction-feedback">
                  <span class="red">
                  ${i18next.t('instructions.core-math.text16')}
                  </span>
              </p>
          </div>
          <img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>
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
      startTime = performance.now(); //get initial time
    },
    on_load: () => {
      document.getElementById('question_input_key_0').focus();

      let elements = document.getElementsByClassName('katex');
      // Loop through the elements and change the font size
      for (let i = 0; i < elements.length; i++) {
        elements[i].style.fontSize = '3.5vh';
      }

      //disable button to prevent double clicks
      const btn = document.getElementById('go-button-id');
      if (btn) {
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
          btn.style.pointerEvents = 'auto';
        }, 1000);
      }

      //hide the survey form submit button
      const submit_button = document.getElementById('jspsych-survey-html-form-next');
      submit_button.classList.add('hide-submit');

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

      //store the textbox value at each keypress
      document.getElementById('question_input_key_0').addEventListener('input', function () {
        textboxVal[0] = this.value;
      });
      document.getElementById('question_input_key_1').addEventListener('input', function () {
        textboxVal[1] = this.value;
      });

      document.getElementById('jspsych-survey-html-form').addEventListener('keydown', (event) => {
        //only permit numbers, backspace and enter key
        if (event.code === 'ArrowUp') {
          storeKeyRT(event.key);
          event.preventDefault(); // Prevent default behavior
          let element = document.getElementById('question_input_key_0');
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
          //element.setSelectionRange(0, 0);
        } else if (event.code === 'ArrowDown') {
          storeKeyRT(event.key);
          event.preventDefault(); // Prevent default behavior
          let element = document.getElementById('question_input_key_1');
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
          //element.setSelectionRange(0, 0);
        } else if (
          (!event.code.includes('Digit') || !isFinite(event.key)) &&
          event.code !== 'Backspace' &&
          event.code !== 'Enter'
        ) {
          //only allows numbers, backspace, minus, period, and enter
          event.preventDefault();
        } else {
          storeKeyRT(event.key);
        }
      });

      document.getElementById('go-button-id').addEventListener('click', function () {
        //so that key press is allowed at the start of next trial
        store.session.set('allowKeyUp', true);
        jsPsych.finishTrial();
      });
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
        if (textboxVal.hasOwn(i)) {
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

      store.session.set('allowKeyUp', true);
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
                    <input type="text" name="question_input_0" id="question_input_key_0" value="${currentItem.target[0]}" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
      currentItem.textbox_width +
      `vw;">
                    <hr>
                    <input type="text" name="question_input_1" id="question_input_key_1" value="${currentItem.target[1]}" class="response-box fraction-practice-textbox" style="box-sizing: border-box; width: ` +
      currentItem.textbox_width +
      `vw;">
                </div>
            </div>`;

    return (
      `<div class="jspsych-content-modified">
        
          <div class="row">
          <div class="instruction-boxes fade-in-1" style="width: 80vw;" id="panel1">
            <div class="text-image">
              <p style="font-size: 3vh; margin-right: 5vh;">` +
      currentItem.item +
      `<br><br>${i18next.t('instructions.core-math.text15')}
              </p>
              <img src="${mediaAssets.images.keyboardFraction}" alt="arrow keys" style="width: 30vw; padding: 2vh;">
            </div>
          </div>
        </div>
        <div class="item-stimulus-long">` +
      responseHTML +
      `<p class="fraction-feedback">
                  <span class="green">
                  ${i18next.t('instructions.fluency.text10')}
                  </span>
              </p>
        </div>
        </div>`
    );
  },
  keyboard_choices: () => [],
  button_choices: () => [''],
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  response_ends_trial: true,
  trial_ends_after_audio: true,
  on_load: () => {
    let elements = document.getElementsByClassName('katex');
    // Loop through the elements and change the font size
    for (let i = 0; i < elements.length; i++) {
      elements[i].style.fontSize = '3.5vh';
    }

    //disable button to prevent double clicks
    const btn = document.getElementById('go-button-id');
    if (btn) {
      btn.style.pointerEvents = 'none';
      setTimeout(() => {
        btn.style.pointerEvents = 'auto';
      }, 1000);
    }
  },
  on_finish: () => {
    store.session.set('allowKeyUp', true);
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

export const fractionInstructionDesktop = (corpusName, assessment_stage_val) => {
  return {
    timeline: [
      fractionInstructionTrial(corpusName, assessment_stage_val),
      ifIncorrect(corpusName, assessment_stage_val),
      ifCorrect,
    ],
  };
};
