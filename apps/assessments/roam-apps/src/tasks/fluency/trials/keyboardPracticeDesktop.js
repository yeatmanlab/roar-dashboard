import store from 'store2'; //storing session data
import { jsPsych } from '../../taskSetup';
import jsPsychSurveyHtmlForm from '@jspsych/plugin-survey-html-form';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import i18next from 'i18next';

let source1, source2;
let rt = [];
let key = [];
let textboxVal;
let startTime;

export const practiceStimulusDesktop = {
  type: jsPsychSurveyHtmlForm,
  html: () => {
    return `
      <div class="jspsych-content-modified instructions-bg">
        <h2 class="title">${i18next.t('instructions.text1')}</h2>
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

              <p class="practice-text">${i18next.t('instructions.fluency.text9')}</p>
              <input type="text" name="practice_number" id="practice_number" class="textbox">
            </div>  
            </div>
        </div>`;
  },
  on_start: () => {
    //initialise variables for trial
    rt = [];
    key = [];
    textboxVal = null;
    startTime = performance.now(); //get initial time
    document.body.style.cursor = 'none';
  },
  data: {
    // Here is where we specify that we should save the trial to Firestore
    assessment_stage: 'practice',
  },
  on_load: () => {
    document.getElementById('practice_number').focus();

    document.getElementById('practice_number').addEventListener('input', function () {
      textboxVal = this.value;
    });

    async function replayAudio(audioFile) {
      const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

      // Returns a promise of the AudioBuffer of the preloaded file path.
      const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(audioFile);

      source2 = jsPsychAudioCtx.createBufferSource();
      source2.buffer = audioBuffer;
      source2.connect(jsPsychAudioCtx.destination);
      source2.start(0);
    }
    replayAudio(mediaAssets.audio.instructionsFluencyPractice);

    //hide the survey form submit button
    const submit_button = document.getElementById('jspsych-survey-html-form-next');
    submit_button.classList.add('hide-submit');

    document.getElementById('jspsych-survey-html-form').addEventListener('keydown', (event) => {
      //only permit numbers, backspace and enter key
      if (
        (!event.code.includes('Digit') || !isFinite(event.key)) &&
        event.code !== 'Backspace' &&
        event.code !== 'Enter'
      ) {
        event.preventDefault();
      }
      const endTime = performance.now();
      const response_time = Math.round(endTime - startTime);
      const name = event.key;
      key.push(name);
      rt.push(response_time);
    });
  },
  on_finish: () => {
    if (source2) {
      source2.stop();
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

export const feedbackIncorrectDesktop = {
  type: jsPsychSurveyHtmlForm,
  html: () => {
    return `
      <div class="jspsych-content-modified instructions-bg">
        <h2 class="title">${i18next.t('instructions.text1')}</h2>
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

              <p class="practice-text">${i18next.t('instructions.fluency.text9')}</p>
              <input type="text" name="practice_number" id="practice_number" class="textbox">
              <p class="feedback">
                <span class="red">
                ${i18next.t('instructions.fluency.text12')}
                </span>
            </p>
            </div>  
            </div>
        </div>`;
  },
  on_start: () => {
    //initialise variables for trial
    rt = [];
    key = [];
    textboxVal = null;
    startTime = performance.now(); //get initial time
  },
  data: {
    // Here is where we specify that we should save the trial to Firestore
    assessment_stage: 'practice',
  },
  on_load: () => {
    document.getElementById('practice_number').focus();

    document.getElementById('practice_number').addEventListener('input', function () {
      textboxVal = this.value;
    });

    async function replayAudio(audioFile) {
      const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

      // Returns a promise of the AudioBuffer of the preloaded file path.
      const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(audioFile);

      source1 = jsPsychAudioCtx.createBufferSource();
      source1.buffer = audioBuffer;
      source1.connect(jsPsychAudioCtx.destination);
      source1.start(0);
    }
    replayAudio(mediaAssets.audio.practiceFluencyIncorrect);

    //hide the survey form submit button
    const submit_button = document.getElementById('jspsych-survey-html-form-next');
    submit_button.classList.add('hide-submit');

    document.getElementById('jspsych-survey-html-form').addEventListener('keydown', (event) => {
      //only permit numbers, backspace and enter key
      if (
        (!event.code.includes('Digit') || !isFinite(event.key)) &&
        event.code !== 'Backspace' &&
        event.code !== 'Enter'
      ) {
        event.preventDefault();
      }
      const endTime = performance.now();
      const response_time = Math.round(endTime - startTime);
      const name = event.code;
      key.push(name);
      rt.push(response_time);
    });
  },
  on_finish: () => {
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

export const feedbackCorrectDesktop = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.instructionsFluencyCorrect;
  },
  prompt: () => {
    return `
      <div class="jspsych-content-modified instructions-bg">
        <h2 class="title">${i18next.t('instructions.text1')}</h2>
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

              <p class="practice-text">${i18next.t('instructions.fluency.text9')}</p>
              <input type="text" name="practice_number" id="practice_number" class="textbox">
              <p class="feedback">
                  <span class="green">
                  ${i18next.t('instructions.fluency.text10')}
                  </span>
              </p>
            </div>  
            </div>
        </div>`;
  },
  on_load: () => {
    document.getElementById('practice_number').value = store.session.get('response');
    //document.getElementById("practice_number").focus();
  },
  response_allowed_while_playing: true,
  response_ends_trial: true, // allow skipping via button
  trial_ends_after_audio: true,
  keyboard_choices: () => 'ALL_KEYS',
  button_choices: () => [],
  on_start: () => (document.body.style.cursor = 'none'),
};
