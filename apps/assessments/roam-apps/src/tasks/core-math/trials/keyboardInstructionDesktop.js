import jsPsychSurveyHtmlForm from '@jspsych/plugin-survey-html-form';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import i18next from 'i18next';
import store from 'store2';
import { isMobile } from './trialHelpers';

let rt = [];
let key = [];
let startTime;
let textboxVal;
let source;

const keyboardInstructionTrial = (corpusName, assessment_stage_val) => {
  return {
    type: jsPsychSurveyHtmlForm,
    html: () => {
      let currentItem = store.session.get('nextStimulus');
      return (
        `
          <div class="jspsych-content-modified instructions-bg">
            <p class="instructions-text" style="font-size: 2.5vh;">${currentItem.item_raw}</p>
            <div class="row">
                <div class="instruction-boxes fade-in-1"  style="width: 50vw;" id="panel1">
                <img src="${mediaAssets.images.keyboardExample}" alt="arrow keys" style="margin-top: 5vh;">
                </div>  
                <div class="no-box" style="flex-basis: 120%;" id="panel3">
                  
                  <ol>
                    <li>${i18next.t('instructions.fluency.text2')}</li>
                    <li style="margin-top: 0.5vh">${i18next.t('instructions.fluency.text4')}</li>
                    <li style="margin-top: 0.5vh">${i18next.t('instructions.fluency.text6')}</li>
                  </ol>
                  <p class="practice-text">${i18next.t('instructions.core-math.text14')}</p>
                  <input type="text" name="practice_number" id="practice_number" class="textbox" style="width:"` +
        currentItem.textbox_width +
        `>
                  
                </div>  
                </div>
            </div>`
      );
    },

    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = null;
      startTime = performance.now();
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_load: () => {
      document.getElementById('practice_number').focus();

      document.getElementById('practice_number').addEventListener('input', function () {
        textboxVal = this.value;
      });

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

      //hide the survey form submit button
      const submit_button = document.getElementById('jspsych-survey-html-form-next');
      submit_button.classList.add('hide-submit');

      const storeKeyPress = (event) => {
        //only permit numbers, backspace and enter key
        if (
          (!event.code.includes('Digit') || !isFinite(event.key)) &&
          event.code !== 'Backspace' &&
          event.code !== 'Enter'
        ) {
          event.preventDefault();
        } else {
          const endTime = performance.now();
          const response_time = Math.round(endTime - startTime);
          const name = event.key;
          key.push(name);
          rt.push(response_time);
        }
      };

      document.getElementById('jspsych-survey-html-form').addEventListener('keydown', storeKeyPress);
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
    type: jsPsychSurveyHtmlForm,
    html: () => {
      let currentItem = store.session.get('nextStimulus');
      return (
        `
          <div class="jspsych-content-modified instructions-bg">
            <p class="instructions-text" style="font-size: 2.5vh;">${currentItem.item_raw}</p>
            <div class="row">
                <div class="instruction-boxes fade-in-1"  style="width: 50vw;" id="panel1">
                <img src="${mediaAssets.images.keyboardExample}" alt="arrow keys" style="margin-top: 5vh;">
                </div>  
                <div class="no-box" style="flex-basis: 120%;" id="panel3">
                  
                  <ol>
                    <li>${i18next.t('instructions.fluency.text2')}</li>
                    <li style="margin-top: 0.5vh">${i18next.t('instructions.fluency.text4')}</li>
                    <li style="margin-top: 0.5vh">${i18next.t('instructions.fluency.text6')}</li>
                  </ol>
                  <p class="practice-text">${i18next.t('instructions.core-math.text14')}</p>
                  <input type="text" name="practice_number" id="practice_number" class="textbox" style="width:"` +
        currentItem.textbox_width +
        `>
          <p class="feedback">
                    <span class="red">
                    ${i18next.t('instructions.core-math.text16')}
                    </span>
                </p>
                  
                </div>  
                </div>
            </div>`
      );
    },

    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = null;
      startTime = performance.now();
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_load: () => {
      document.getElementById('practice_number').focus();

      document.getElementById('practice_number').addEventListener('input', function () {
        textboxVal = this.value;
      });

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

      //hide the survey form submit button
      const submit_button = document.getElementById('jspsych-survey-html-form-next');
      submit_button.classList.add('hide-submit');

      const storeKeyPress = (event) => {
        //only permit numbers, backspace and enter key
        if (
          (!event.code.includes('Digit') || !isFinite(event.key)) &&
          event.code !== 'Backspace' &&
          event.code !== 'Enter'
        ) {
          event.preventDefault();
        } else {
          const endTime = performance.now();
          const response_time = Math.round(endTime - startTime);
          const name = event.key;
          key.push(name);
          rt.push(response_time);
        }
      };

      document.getElementById('jspsych-survey-html-form').addEventListener('keydown', storeKeyPress);
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
            <p class="instructions-text" style="font-size: 2.5vh;">${currentItem.item_raw}</p>
            <div class="row">
                <div class="instruction-boxes fade-in-1"  style="width: 50vw;" id="panel1">
                <img src="${mediaAssets.images.keyboardExample}" alt="arrow keys" style="margin-top: 5vh;">
                </div>  
                <div class="no-box" style="flex-basis: 120%;" id="panel3">
                  
                  <ol>
                    <li>${i18next.t('instructions.fluency.text2')}</li>
                    <li style="margin-top: 0.5vh">${i18next.t('instructions.fluency.text4')}</li>
                    <li style="margin-top: 0.5vh">${i18next.t('instructions.fluency.text6')}</li>
                  </ol>
                  <p class="practice-text">${i18next.t('instructions.core-math.text14')}</p>
                  <input type="text" name="practice_number" id="practice_number" value="${
                    currentItem.target[0]
                  }" class="textbox" style="width:` +
      currentItem.textbox_width +
      `">
          <p class="feedback">
                  <span class="green">
                  ${i18next.t('instructions.fluency.text10')}
                  </span>
              </p>
                  
                </div>  
                </div>
            </div>`
    );
  },
  keyboard_choices: () => [],
  button_choices: () => [''],
  button_html: () => '',
  response_ends_trial: false,
  trial_ends_after_audio: true,
  /*on_load: () => {
    //disable button to prevent double clicks
    const btn = document.getElementById("go-button-id");
    if (btn) {
      btn.style.pointerEvents = "none";
      setTimeout(() => {
        btn.style.pointerEvents = "auto";
      }, 1000);
    }
  },*/
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

export const keyboardInstructionDesktop = (corpusName, assessment_stage_val) => {
  return {
    timeline: [
      keyboardInstructionTrial(corpusName, assessment_stage_val),
      ifIncorrect(corpusName, assessment_stage_val),
      ifCorrect,
    ],
  };
};

/*export const keyboardInstruction = (corpusName, assessment_stage_val) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      return mediaAssets.audio.coreMathKeyboardInstruction;
    },
    prompt: () => {
      let currentItem = store.session.get("nextStimulus");
      return `
      <div class="jspsych-content-modified">
        <p class="instructions-text" style="font-size: 2.5vh;">${currentItem.item_raw}</p>
        <div class="row">
          <div class="instruction-boxes fade-in-1" id="panel1">
          <img src="${mediaAssets.images.keyboardNumbers}" alt="arrow keys">
            <p>${i18next.t("instructions.core-math.text3")}</p>
          </div>
          <div class="instruction-boxes fade-in-1" id="panel2">
          <img src="${mediaAssets.images.keyboardEnter}" alt="arrow keys">
            <p>${i18next.t("instructions.core-math.text4")}</p>
          </div>
          <div class="instruction-boxes fade-in-1" id="panel3">
          <img src="${mediaAssets.images.keyboardBackspace}" alt="arrow keys">
            <p>${i18next.t("instructions.core-math.text5")}</p>
          </div>
        </div>
        
        <div class="item-stimulus-long">
          <div class="response-horizontal">
              <input readonly type="text" value="5" class="response-box" style="margin-top: 0vh; margin-bottom: 0vh; pointer-events: none; text-align:center; width: ` +
                        currentItem.textbox_width +
                        `vw;">
              <p style="font-size: 5vh; margin-top: 0vh; margin-bottom: 0vh;"> : </p>
              <input type="text" name="question_input_0" id="question_input_key_0" class="response-box" style="margin-top: 0vh; margin-bottom: 0vh; text-align:center; width: ` +
                        currentItem.textbox_width +
                        `vw;">
          </div>
        </div>

      </div>
      `;
    },
    keyboard_choices: () => ["Enter"],
    button_choices: () => [""],
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      startTime = performance.now(); //get initial time
    },
    on_load: () => {
      document.getElementById("question_input_key_0").focus();

      const storeKeyPress = (event) => {
        //only permit numbers, backspace and enter key
        if (
          (!event.code.includes("Digit") || !isFinite(event.key)) &&
          event.code !== "Backspace" &&
          event.code !== "Enter"
        ) {
          event.preventDefault();
        } else {
          const endTime = performance.now();
          const response_time = Math.round(endTime - startTime);
          const name = event.code;
          key.push(name);
          rt.push(response_time);
          if(event.code === "Enter"){
            textbox_value = document.getElementById("question_input_key_0").value;
            finalRT = response_time;

          }
        }
      };

      document
        .getElementById("jspsych-audio-multi-response-prompt")
        .addEventListener("keydown", storeKeyPress);

    },
    on_finish: (data) => {
      let save_trial = true;
      const stimulus = store.session.get("nextStimulus");
     
      let response_val = textbox_value!=null ? textbox_value.replace(/\s+/g, "") : textbox_value;
      let correct = response_val === stimulus.target[0] ? 1 : 0;

      store.session.set("dataCorrect", correct); 

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
        pid: store.session.get("config").pid,
        corpus_name: "keyboardInstruction",
        trial_num_block: store.session("indexTracking") + 1,
        item_id: stimulus.itemID,
        problem_id: null,
        problem_version: null,
        item_grade_level: null,
        theoretical_difficulty: null,
        choices: null,
        correct_response_num: null,
        choice_index: null,
        response: response_val,
        correct: store.session("dataCorrect"),
        item: stimulus.item_raw,
        target: stimulus.target[0],
        response_key_list: key,
        response_time_list: rt,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        rt: finalRT,
      });

      
    },    
  }
};*/
