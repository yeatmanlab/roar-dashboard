import store from 'store2';
import { jsPsych } from '../../taskSetup';
import { mediaAssets } from '../../..';
import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
import { validityEvaluator } from '../timeline';
import { startTimer } from '../helpers/updateCountDown';
import { catIRT } from '../timeline';
import { addResponse, endGame, updateSkillScores, scaleTheta } from './trialHelpers';
import { updateGradeEstimateObject } from './gradeEstimateHelpers';
import { isMobile } from './trialHelpers';

// store dragging time for each apple
let dropCount;
let source;
let audioFile;

//hard coding 10 total apples positions
let sourcePositions = [
  ['0vw', '3vw'],
  ['0vw', '9vw'],
  ['0vw', '15vw'],
  ['7vw', '0vw'],
  ['7vw', '6vw'],
  ['7vw', '12vw'],
  ['7vw', '18vw'],
  ['14vw', '3vw'],
  ['14vw', '9vw'],
  ['14vw', '15vw'],
];

let destinationPositions = [
  ['0vw', '6vw'],
  ['0vw', '12vw'],
  ['0vw', '18vw'],
  ['5vw', '3vw'],
  ['5vw', '9vw'],
  ['5vw', '15vw'],
  ['5vw', '21vw'],
  ['10vw', '6vw'],
  ['10vw', '12vw'],
  ['10vw', '18vw'],
];

// Fixed item. Drag apples to a basket.
export const giveNClick = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychHtmlButtonResponse,
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    stimulus: () => {
      //to set the dimensions of the timer in pixels (make sure it is even)
      let diameter = 2 * Math.round(window.innerWidth * 0.05); //hard code timer to be 10% width of screen

      return `
          <canvas id="canvas-timer" width="${diameter}" height="${diameter}" class="canvas-timer"></canvas>
          <img id="replay" draggable="false" src="${mediaAssets.images.iconSpeaker}" alt="replay"/> 
          <div class=item-stimulus-long>
            <div class=question-box>
              <p>${store.session.get('nextStimulus').item}</p>
            </div>
          </div>
        <div class="giveN-container">
          <div class="source-container" id="source-container">
            <img class="source" id="apple1" src=${
              mediaAssets.images.apple
            } alt="Image 1" draggable="false" style="top: ${sourcePositions[0][0]}; left: ${sourcePositions[0][1]}">
            <img class="source" id="apple2" src=${
              mediaAssets.images.apple
            } alt="Image 2" draggable="true" style="top: ${sourcePositions[1][0]}; left: ${sourcePositions[1][1]}">
            <img class="source" id="apple3" src=${
              mediaAssets.images.apple
            } alt="Image 3" draggable="true" style="top: ${sourcePositions[2][0]}; left: ${sourcePositions[2][1]}">
            <img class="source" id="apple4" src=${
              mediaAssets.images.apple
            } alt="Image 4" draggable="true" style="top: ${sourcePositions[3][0]}; left: ${sourcePositions[3][1]}">
            <img class="source" id="apple5" src=${
              mediaAssets.images.apple
            } alt="Image 5" draggable="true" style="top: ${sourcePositions[4][0]}; left: ${sourcePositions[4][1]}">
            <img class="source" id="apple6" src=${
              mediaAssets.images.apple
            } alt="Image 6" draggable="true" style="top: ${sourcePositions[5][0]}; left: ${sourcePositions[5][1]}">
            <img class="source" id="apple7" src=${
              mediaAssets.images.apple
            } alt="Image 7" draggable="true" style="top: ${sourcePositions[6][0]}; left: ${sourcePositions[6][1]}">
            <img class="source" id="apple8" src=${
              mediaAssets.images.apple
            } alt="Image 8" draggable="true" style="top: ${sourcePositions[7][0]}; left: ${sourcePositions[7][1]}">
            <img class="source" id="apple9" src=${
              mediaAssets.images.apple
            } alt="Image 9" draggable="true" style="top: ${sourcePositions[8][0]}; left: ${sourcePositions[8][1]}">
            <img class="source" id="apple10" src=${
              mediaAssets.images.apple
            } alt="Image 10" draggable="true" style="top: ${sourcePositions[9][0]}; left: ${sourcePositions[9][1]}">   
          </div>
          <div class="dropzone-container" id="dropzone-container">
              <img id="dropzone-image" class="dropzone-container-image"src=${
                mediaAssets.images.basket
              } draggable="false">
              <div class="dropzone" id="dropzone"></div>
          </div>
        </div>`;
    },
    choices: () => [''],
    button_html: () =>
      `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    on_start: () => {
      //initialise variables for trial
      dropCount = 0;
      //set the timer only for the default usermode
      if (store.session.get('config').userMode === 'default') {
        // set timeout for forcefully ending the trial
        const timerId = setTimeout(() => {
          store.session.set('timeOut', true);
          jsPsych.finishTrial();
        }, store.session.get('nextStimulus').time_limit);
        store.session.set('timerId', timerId);
      }
    },
    on_load: () => {
      //set the timer only for the default usermode
      if (store.session.get('config').userMode === 'default') {
        // set timeout for showing the countdown
        let countdownTime = store.session.get('nextStimulus').countdown_time;
        const timerIdCountdown = setTimeout(() => {
          startTimer(countdownTime);
        }, store.session.get('nextStimulus').countDownAppears);
        store.session.set('timerIdCountdown', timerIdCountdown);
      }
      //setup replay button
      const replayBtn = document.getElementById('replay');
      audioFile = store.session.get('nextStimulus').audio_file;

      async function replayAudio() {
        // pause audio
        if (source) {
          source.stop();
        }

        const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

        // Returns a promise of the AudioBuffer of the preloaded file path.
        const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(mediaAssets.audio[audioFile]);

        source = jsPsychAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(jsPsychAudioCtx.destination);
        source.start(0);
      }

      replayBtn.addEventListener('click', replayAudio);
      //play audio immediately when item loads
      replayAudio();

      const btn = document.getElementById('go-button-id');
      if (btn) {
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
          btn.style.pointerEvents = 'auto';
        }, 1000);
      }

      // Select the image element that you want to move
      const images = document.querySelectorAll('.source');
      const dropzoneContainer = document.getElementById('dropzone-container');
      const sourceContainer = document.getElementById('source-container');
      let isMoved = new Array(10).fill(0);
      // Set a flag to track the image's current position
      //let isMoved = false;
      // Store the original position (left and top) of the image

      images.forEach((image, index) => {
        image.addEventListener('click', (event) => {
          if (!isMoved[index]) {
            // Position the image relative to the destination image
            image.style.left = destinationPositions[index][1]; // Adjust '20' to set desired offset from the destination
            image.style.top = destinationPositions[index][0]; // Adjust '20' to set desired offset from the destination

            // Append the image to the container (parent of the destination image)
            dropzoneContainer.appendChild(image);
            isMoved[index] = 1;
            dropCount++;
          } else {
            image.style.left = sourcePositions[index][1]; // Adjust '20' to set desired offset from the destination
            image.style.top = sourcePositions[index][0]; // Adjust '20' to set desired offset from the destination

            sourceContainer.appendChild(image);
            isMoved[index] = 0;
            dropCount--;
          }
        });
      });
    },
    on_finish: (data) => {
      // stop the function that updates the countdown timer
      clearInterval(store.session.get('intervalId'));
      clearTimeout(store.session.get('timerId'));
      clearTimeout(store.session.get('timerIdCountdown'));

      // pause audio
      if (source) {
        source.stop();
      }

      //all trials are saved, but timeout trials are marked incorrect
      const stimulus = store.session.get('nextStimulus');

      // check response and record it
      let correct = dropCount === parseInt(stimulus.target[0]) && !store.session.get('timeOut') ? 1 : 0;
      // for adding response to tracker
      store.session.set('dataCorrect', correct);

      //update grade estimate object
      let zetaGrade = {
        a: stimulus.a,
        b: stimulus.b_grade,
        c: stimulus.c,
        d: stimulus.d,
      };
      let gradeEstimateObject = store.session.get('gradeEstimateObject');
      updateGradeEstimateObject(gradeEstimateObject, 'composite', zetaGrade, correct, stimulus.b_grade);
      updateGradeEstimateObject(
        gradeEstimateObject,
        stimulus.skill_category_camel,
        zetaGrade,
        correct,
        stimulus.b_grade,
      );
      store.session.set('gradeEstimateObject', gradeEstimateObject);

      //update cat to get theta estimate
      if (stimulus.b !== null && !Number.isNaN(stimulus.b)) {
        let zetaIRT = {
          a: stimulus.a,
          b: stimulus.b,
          c: stimulus.c,
          d: stimulus.d,
        };
        catIRT.updateAbilityEstimate(zetaIRT, correct);
        store.session.set('thetaEstimateRaw', catIRT.theta);
        store.session.set('thetaEstimate', scaleTheta(catIRT.theta));
      }

      //add response to tracker
      addResponse(correct, store.session.get('responseWindowSize'));

      //check if game will end with this trial, updates grade estimates if game end is true
      endGame(
        store.session.get('responseTracker'),
        store.session.get('stopCriterion'),
        store.session.get('responseWindowSize'),
      );

      //update subskill scores
      updateSkillScores(correct, stimulus);

      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        time_out: store.session.get('timeOut'),
        pid: store.session.get('config').pid,
        subtask: stimulus.skill_category_camel,
        skill: stimulus.skill,
        skill_category: stimulus.skill_category,
        corpus_name: 'giveN',
        trial_num_total: store.session.get('trialNumTotal') + 1,
        trial_num_block: store.session.get('indexTracking') + 1,
        item_id: stimulus.itemID,
        problem_id: stimulus.problemID,
        problem_version: stimulus.version,
        item_grade_level: stimulus.cc_grade_level,
        theoretical_difficulty: stimulus.cc_grade_level,
        choices: null,
        correct_response_num: null,
        choice_index: null,
        response: dropCount,
        correct: store.session.get('dataCorrect'),
        thetaEstimateRaw: catIRT.theta,
        thetaEstimate: store.session.get('thetaEstimate'),
        thetaSE: catIRT.seMeasurement === Infinity ? Number.MAX_VALUE : catIRT.seMeasurement,
        item: stimulus.item_raw,
        target: stimulus.target[0],
        response_key_list: null,
        response_time_list: null,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        is_mobile: isMobile,
      });

      // update trial count
      if (corpusName === 'stimulus') {
        store.session.transact('trialNumTotal', (oldVal) => oldVal + 1);

        // feed response to fluencyValidityEvaluator for evaluation per trial
        validityEvaluator.addResponseData(data.rt, dropCount.toString(), store.session.get('dataCorrect'));
      }

      //if the very next trial is textboxResponse, key press should be allowed
      store.session.set('allowKeyUp', true);
    },
  };
  return stim;
};
