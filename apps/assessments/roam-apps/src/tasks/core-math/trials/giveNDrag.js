import store from 'store2';
import { jsPsych } from '../../taskSetup';
import { mediaAssets } from '../../..';
import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
import { validityEvaluator , catIRT } from '../timeline';
import { startTimer } from '../helpers/updateCountDown';
import { addResponse, endGame, updateSkillScores , isMobile } from './trialHelpers';
import { updateGradeEstimateObject } from './gradeEstimateHelpers';
import _round from 'lodash/round';

// store dragging time for each apple
let rt = [];
let dropCount;
let startTime;
let source;

// Fixed item. Drag apples to a basket.
export const giveN = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychHtmlButtonResponse,
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    stimulus: () => {
      //hard coding 10 total apples positioned on a tree
      let positions = [
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
            } alt="Image 1" draggable="true" style="top: ${positions[0][0]}; left: ${positions[0][1]}">
            <img class="source" id="apple2" src=${
              mediaAssets.images.apple
            } alt="Image 2" draggable="true" style="top: ${positions[1][0]}; left: ${positions[1][1]}">
            <img class="source" id="apple3" src=${
              mediaAssets.images.apple
            } alt="Image 3" draggable="true" style="top: ${positions[2][0]}; left: ${positions[2][1]}">
            <img class="source" id="apple4" src=${
              mediaAssets.images.apple
            } alt="Image 4" draggable="true" style="top: ${positions[3][0]}; left: ${positions[3][1]}">
            <img class="source" id="apple5" src=${
              mediaAssets.images.apple
            } alt="Image 5" draggable="true" style="top: ${positions[4][0]}; left: ${positions[4][1]}">
            <img class="source" id="apple6" src=${
              mediaAssets.images.apple
            } alt="Image 6" draggable="true" style="top: ${positions[5][0]}; left: ${positions[5][1]}">
            <img class="source" id="apple7" src=${
              mediaAssets.images.apple
            } alt="Image 7" draggable="true" style="top: ${positions[6][0]}; left: ${positions[6][1]}">
            <img class="source" id="apple8" src=${
              mediaAssets.images.apple
            } alt="Image 8" draggable="true" style="top: ${positions[7][0]}; left: ${positions[7][1]}">
            <img class="source" id="apple9" src=${
              mediaAssets.images.apple
            } alt="Image 9" draggable="true" style="top: ${positions[8][0]}; left: ${positions[8][1]}">
            <img class="source" id="apple10" src=${
              mediaAssets.images.apple
            } alt="Image 10" draggable="true" style="top: ${positions[9][0]}; left: ${positions[9][1]}">           
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
    button_html: () => `<img class="go-button" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    on_start: () => {
      //initialise variables for trial
      rt = [];
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
      startTime = performance.now(); //get initial time
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

      async function replayAudio() {
        // pause audio
        if (source) {
          source.stop();
        }

        const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

        // Returns a promise of the AudioBuffer of the preloaded file path.
        const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(mediaAssets.audio.gameEnd);

        source = jsPsychAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(jsPsychAudioCtx.destination);
        source.start(0);
      }

      replayBtn.addEventListener('click', replayAudio);

      // Track the element being dragged
      let draggedElement = null;

      // Add event listeners for all draggable images
      const images = document.querySelectorAll('.source');

      images.forEach((img) => {
        // When dragging starts
        img.addEventListener('dragstart', (event) => {
          draggedElement = event.target;
          event.target.style.opacity = 0.5; // Make the dragged item semi-transparent
        });

        // When dragging ends
        img.addEventListener('dragend', (event) => {
          event.target.style.opacity = 1; // Reset opacity when dragging stops
        });
      });

      // oval region inside the basket for dropping apples
      const dropzone = document.getElementById('dropzone');
      // entire basket
      const dropzoneContainer = document.getElementById('dropzone-container');

      //change these to dropzoneContainer if removing oval dropzone
      dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
      });

      dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        // Get the drop coordinates relative to the dropzone container to append the apple to the container
        const dropX = event.clientX - dropzoneContainer.offsetLeft;
        const dropY = event.clientY - dropzoneContainer.offsetTop;

        // Move the dragged element to the new position
        draggedElement.style.left = `${dropX - draggedElement.offsetWidth / 2}px`;
        draggedElement.style.top = `${dropY - draggedElement.offsetHeight / 2}px`;
        draggedElement.setAttribute('draggable', false);

        dropzoneContainer.appendChild(draggedElement);

        // get the response time for each apple
        const endTime = performance.now();
        const response_time = Math.round(endTime - startTime);
        rt.push(response_time);

        dropCount += 1;
      });
    },
    on_finish: (data) => {
      // stop the function that updates the countdown timer
      clearInterval(store.session.get('intervalId'));

      // pause audio
      if (source) {
        source.stop();
      }

      // Disable draggable attribute
      const images = document.querySelectorAll('.source');
      images.forEach((img) => {
        img.setAttribute('draggable', 'false');
      });

      //if timeout occured, trial is not saved
      let save_trial = !store.session.get('timeOut');
      const stimulus = store.session.get('nextStimulus');

      // check response and record it
      let correct = dropCount === parseInt(stimulus.target[0]) ? 1 : 0;

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
        store.session.set('thetaEstimate', _round(catIRT.theta, 2));
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

      // Add the final response time to the array
      rt.push(data.rt);

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
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
        thetaEstimate: catIRT.theta,
        thetaSE: catIRT.seMeasurement === Infinity ? Number.MAX_VALUE : catIRT.seMeasurement,
        item: stimulus.item_raw,
        target: stimulus.target[0],
        response_key_list: null,
        response_time_list: rt,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        is_mobile: isMobile,
      });

      // update trial count
      if (corpusName === 'stimulus' && save_trial) {
        store.session.transact('trialNumTotal', (oldVal) => oldVal + 1);

        // feed response to fluencyValidityEvaluator for evaluation per trial
        validityEvaluator.addResponseData(data.rt, dropCount.toString(), store.session.get('dataCorrect'));
      }
    },
  };
  return stim;
};
