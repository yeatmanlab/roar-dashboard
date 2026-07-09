import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..'; //media files
import i18next from 'i18next';
import '../../../i18n/i18n';
import store from 'store2'; //storing session data
import { instructionExample } from './practiceExample';
import { jsPsych } from '../../taskSetup';

let rt = [];
let key = [];
let startTime;

const instructionPracticeIntro = (instr) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      return mediaAssets.audio[instr.audio];
    },
    prompt: () => {
      let inputBox = '';
      if (instr.name === 'number') {
        inputBox = `<input type="text" name="practice_number" id="practice_number" class="textbox">`;
      }
      return (
        `
    <div class="instructions-kids">
      <h2 class="title">${i18next.t('instructions.text1')}</h2>
      <div class="instructions-container">
        <div class="gif-container fade-in-1">
          <p class="instructions-text">${i18next.t(instr.innerText1)}</p>
          <img src="${mediaAssets.images[instr.image]}" alt="arrow keys">
          
        </div>
        <div class="practice-container">
          <p class="practice-text">${i18next.t(instr.innerText2)}</p>
          ` +
        inputBox +
        `
        </div>
      </div>
    </div>

    `
      );
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      startTime = performance.now(); //get initial time
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: 'practice_response',
    },
    on_load: () => {
      if (instr.name === 'number') {
        document.getElementById('practice_number').focus();
      }

      /*let response = store.session.get("practiceKeyPress");
      if (response && response >= 0 && response < 10) {
        document.getElementById("practice_number").value = response;
      }*/

      document.getElementById('jspsych-audio-multi-response-prompt').addEventListener('keydown', (event) => {
        if (instr.name === 'number' && event.code.includes('Digit') && isFinite(event.key)) {
          store.session.set('practiceKeyPress', event.key);
        } else {
          store.session.set('practiceKeyPress', null);
        }

        const endTime = performance.now();
        const response_time = Math.round(endTime - startTime);
        const name = event.code;
        key.push(name);
        rt.push(response_time);
        instr.checkCorrect(event.code);
      });
    },
    on_finish: (data) => {
      if (instr.name != 'number') {
        instr.checkCorrect(data.keyboard_response);
      }

      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        corpusName: instr.name,
        pid: store.session.get('config').pid,
        trialNumBlock: store.session.get('keyboardPracticeCounter') + 1,
        target: instr.target,
        correct: store.session.get('practiceFeedback'),
        response: data.keyboard_response,
        respTime: rt,
        keyPress: key,
      });
    },
    keyboard_choices: () => 'ALL_KEYS',
    button_choices: () => [],
  };
};

const feedbackIncorrect = (instr) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      if (instr.name === 'number') {
        return mediaAssets.audio.practiceFluencyIncorrect;
      }
      return mediaAssets.audio.instructionsFluencyIncorrect;
    },
    prompt: () => {
      let feedbackText = 'instructions.fluency.text11';
      let inputBox = '';
      if (instr.name === 'number') {
        feedbackText = 'instructions.fluency.text12';
        inputBox = `<input type="text" name="practice_number" id="practice_number" class="textbox">`;
      }

      return (
        `
        <div class="instructions-kids">
          <h2 class="title">${i18next.t('instructions.text1')}</h2>
          <div class="instructions-container">
            <div class="gif-container">
              <p class="instructions-text">${i18next.t(instr.innerText1)}</p>
              <img src="${mediaAssets.images[instr.image]}" alt="arrow keys">
              
            </div>
            <div class="practice-container">
              <p class="practice-text">${i18next.t(instr.innerText2)}</p>
              ` +
        inputBox +
        `<p class="feedback">
                  <span class="red">
                  ${i18next.t(feedbackText)}
                  </span>
              </p>
            </div>
          </div>
        </div>
        `
      );
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      startTime = performance.now(); //get initial time
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: 'practice_response',
    },
    on_load: () => {
      if (instr.name === 'number') {
        document.getElementById('practice_number').focus();
      }
      /*let response = store.session.get("practiceKeyPress");
      if (response && response >= 0 && response < 10) {
        document.getElementById("practice_number").value = response;
      }*/
      document.getElementById('jspsych-audio-multi-response-prompt').addEventListener('keydown', (event) => {
        if (instr.name === 'number' && event.code.includes('Digit') && isFinite(event.key)) {
          store.session.set('practiceKeyPress', event.key);
        } else {
          store.session.set('practiceKeyPress', null);
        }
        const endTime = performance.now();
        const response_time = Math.round(endTime - startTime);
        const name = event.code;
        key.push(name);
        rt.push(response_time);
        instr.checkCorrect(event.code);
      });
    },
    on_finish: (data) => {
      if (instr.name != 'number') {
        instr.checkCorrect(data.keyboard_response);
      }

      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        corpusName: instr.name,
        pid: store.session.get('config').pid,
        trialNumBlock: store.session.get('keyboardPracticeCounter') + 1,
        target: instr.target,
        correct: store.session.get('practiceFeedback'),
        response: data.keyboard_response,
        respTime: rt,
        keyPress: key,
      });
    },
    keyboard_choices: () => 'ALL_KEYS',
    button_choices: () => [],
  };
};

const feedbackCorrect = (instr) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      return mediaAssets.audio.instructionsFluencyCorrect;
    },
    prompt: () => {
      let inputBox = '';
      if (instr.name === 'number') {
        inputBox = `<input type="text" name="practice_number" id="practice_number" class="textbox">`;
      }
      return (
        `
        <div class="instructions-kids">
          <h2 class="title">${i18next.t('instructions.text1')}</h2>
          <div class="instructions-container">
            <div class="gif-container">
              <p class="instructions-text">${i18next.t(instr.innerText1)}</p>
              <img src="${mediaAssets.images[instr.image]}" alt="arrow keys">
              
            </div>
            <div class="practice-container">
              <p class="practice-text">${i18next.t(instr.innerText2)}</p>` +
        inputBox +
        `
              <p class="feedback">
                  <span class="green">
                  ${i18next.t('instructions.fluency.text10')}
                  </span>
              </p>
            </div>
          </div>
        </div>
        `
      );
    },
    response_allowed_while_playing: true,
    response_ends_trial: true, // allow skipping via button
    trial_ends_after_audio: true,
    keyboard_choices: () => 'ALL_KEYS',
    button_choices: () => [],
    on_start: () => (document.body.style.cursor = 'none'),
    on_load: () => {
      if (instr.name === 'number') {
        //document.getElementById("practice_number").focus();
        let response = store.session.get('practiceKeyPress');
        if (response && response >= 0 && response < 10) {
          document.getElementById('practice_number').value = response;
        }
      }
    },
  };
};

const feedbackIncorrectLoop = (instr) => {
  return {
    timeline: [feedbackIncorrect(instr)],
    loop_function: () => {
      if (store.session.get('practiceFeedback') !== 1) {
        store.session.transact('keyboardPracticeCounter', (oldVal) => oldVal + 1);
        if (store.session.get('keyboardPracticeCounter') === store.session.get('config').stopCriterion) {
          return false;
        }
      }
      if (store.session.get('practiceFeedback') === 1) {
        return false;
      }
      return true;
    },
  };
};

const ifIncorrect = (instr) => {
  return {
    timeline: [feedbackIncorrectLoop(instr)],
    conditional_function: () => {
      if (store.session.get('practiceFeedback') !== 1) {
        store.session.transact('keyboardPracticeCounter', (oldVal) => oldVal + 1);
        return true;
      } else {
        return false;
      }
    },
  };
};

const ifCorrect = (instr) => {
  return {
    timeline: [feedbackCorrect(instr)],
    conditional_function: () => {
      if (store.session.get('practiceFeedback') === 1) {
        return true;
      }
      return false;
    },
  };
};

const instructionPractice = (instr) => {
  return {
    timeline: [instructionPracticeIntro(instr), ifIncorrect(instr), ifCorrect(instr)],
    on_timeline_finish: () => {
      store.session.set('keyboardPracticeCounter', 0);
    },
  };
};

const checkNumber = (keyCode) => {
  if (keyCode.includes('Digit')) {
    store.session.set('practiceFeedback', 1);
  } else {
    store.session.set('practiceFeedback', 0);
  }
};

const checkEnter = (keyCode) => {
  if (keyCode === 'enter') {
    store.session.set('practiceFeedback', 1);
  } else {
    store.session.set('practiceFeedback', 0);
  }
};

const checkBackspace = (keyCode) => {
  if (keyCode === 'backspace') {
    store.session.set('practiceFeedback', 1);
  } else {
    store.session.set('practiceFeedback', 0);
  }
};

const instructionVariables = {
  number: {
    name: 'number',
    audio: 'instructionsFluencyNumbers',
    image: 'keyboardNumbers',
    innerText1: 'instructions.fluency.text2',
    innerText2: 'instructions.fluency.text3',
    target: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    checkCorrect: checkNumber,
  },
  enter: {
    name: 'enter',
    audio: 'instructionsFluencyEnter',
    image: 'keyboardEnter',
    innerText1: 'instructions.fluency.text4',
    innerText2: 'instructions.fluency.text5',
    target: 'enter',
    checkCorrect: checkEnter,
  },
  backspace: {
    name: 'backspace',
    audio: 'instructionsFluencyBackspace',
    image: 'keyboardBackspace',
    innerText1: 'instructions.fluency.text6',
    innerText2: 'instructions.fluency.text7',
    target: 'backspace',
    checkCorrect: checkBackspace,
  },
};

export const keyboardPracticeSplit = {
  timeline: [
    instructionPractice(instructionVariables['number']),
    instructionPractice(instructionVariables['enter']),
    instructionPractice(instructionVariables['backspace']),
    instructionExample,
  ],
};
