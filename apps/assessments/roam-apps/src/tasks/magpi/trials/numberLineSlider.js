import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
import store from 'store2';
import { mediaAssets } from '../../..';
import { startTimer } from '../../core-math/helpers/updateCountDown';
import { jsPsych } from '../../taskSetup';
import _round from 'lodash/round';
import i18next from 'i18next';
import { isMobile } from '../../fluency/helpers';

let source = null;
export async function playAudio(audioFile, onEnded = null) {
  stopAudio();

  const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

  const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(mediaAssets.audio[audioFile]);

  source = jsPsychAudioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(jsPsychAudioCtx.destination);

  if (onEnded) {
    source.onended = onEnded;
  }
  source.start(0);
}

export function stopAudio() {
  if (!source) return;

  source.onended = null;
  source.stop();
  source = null;
}

function snapValue(value, step) {
  const factor = 1 / step;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function setMarkerFromValue(value, step, minValue, maxValue, marker) {
  value = clamp(snapValue(value, step), minValue, maxValue);

  const percent = (value - minValue) / (maxValue - minValue);

  marker.style.left = `${percent * 100}%`;
}

export function initializeNumberLine({ line, marker, minValue, maxValue, step, onChange, onFirstInteraction }) {
  let dragging = false;
  let hasInteracted = false;

  function notifyFirstInteraction() {
    if (!hasInteracted) {
      hasInteracted = true;
      onFirstInteraction?.();
    }
  }

  function positionToValue(clientX) {
    const rect = line.getBoundingClientRect();

    let percent = (clientX - rect.left) / rect.width;
    percent = clamp(percent, 0, 1);

    let value = minValue + percent * (maxValue - minValue);

    return clamp(snapValue(value, step), minValue, maxValue);
  }

  function moveMarker(clientX) {
    const value = positionToValue(clientX);

    setMarkerFromValue(value, step, minValue, maxValue, marker);

    notifyFirstInteraction();

    onChange?.(value);
  }

  line.addEventListener('pointerdown', (e) => {
    moveMarker(e.clientX);
  });

  marker.addEventListener('pointerdown', (e) => {
    dragging = true;
    marker.classList.add('dragging');
    marker.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  marker.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    moveMarker(e.clientX);
  });

  marker.addEventListener('pointerup', () => {
    dragging = false;
    marker.classList.remove('dragging');
  });

  marker.addEventListener('pointercancel', () => {
    dragging = false;
    marker.classList.remove('dragging');
  });

  setMarkerFromValue(minValue, step, minValue, maxValue, marker);
}

export const numberLineSlider = (assessment_stage_val) => {
  let currentValue;
  let handleContinueClick;

  let stim = {
    type: jsPsychHtmlButtonResponse,
    data: {
      assessment_stage: assessment_stage_val,
    },
    stimulus: () => {
      //to set the dimensions of the timer in pixels (make sure it is even)
      let diameter = 2 * Math.round(window.innerWidth * 0.05); //hard code timer to be 10% width of screen
      return (
        `<canvas id="canvas-timer" width="${diameter}" height="${diameter}" class="canvas-timer"></canvas>
                <div class="number-line-item">` +
        store.session.get('nextStimulus').itemKatex +
        `</div>
                
                <div class="number-line-container">
                    <div class="number-line-element" id="line">
                        <div class="tick left"></div>
                        <div class="tick right"></div>

                        <div class="marker" id="marker"></div>

                        <div class="label left">` +
        store.session.get('nextStimulus').lower +
        `</div>
                        <div class="label right">` +
        store.session.get('nextStimulus').upper +
        `</div>
                    </div>
                </div>
                <div class="number-line-item-below hidden">${i18next.t('warning-number-line')}</div>`
      );
    },
    choices: [''],
    button_html: `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    response_ends_trial: false,
    on_start: () => {
      if (store.session.get('config').userMode === 'default') {
        const timerId = setTimeout(() => {
          store.session.set('timeOut', true);
          jsPsych.finishTrial({ response: currentValue });
        }, store.session.get('numberLineTimeLimit'));
        store.session.set('timerId', timerId);
      }
    },
    on_load: () => {
      const currentItem = store.session.get('nextStimulus');
      const line = document.getElementById('line');
      const marker = document.getElementById('marker');
      const minValue = currentItem.lower;
      const maxValue = currentItem.upper;
      currentValue = minValue;
      const step = currentItem.slider_step;

      let markerMoved = false;

      initializeNumberLine({
        line,
        marker,
        minValue,
        maxValue,
        step,
        onChange: (value) => {
          currentValue = value;
          markerMoved = true;
        },
      });

      const warning = document.querySelector('.number-line-item-below');
      const continueBtn = document.getElementById('jspsych-html-button-response-button-0');

      handleContinueClick = (e) => {
        if (!markerMoved) {
          warning.classList.remove('hidden');
          playAudio('numLineMoveFeedback');
          return;
        }

        jsPsych.finishTrial({ response: currentValue });
      };

      continueBtn.addEventListener('click', handleContinueClick);

      if (store.session.get('config').userMode === 'default') {
        // set timeout for showing the countdown
        let countdownTime = store.session.get('numberLineCountdownTime');
        const timerIdCountdown = setTimeout(() => {
          startTimer(countdownTime);
        }, store.session.get('numberLineCountdownAppears'));
        store.session.set('timerIdCountdown', timerIdCountdown);
      }
    },
    on_finish: (data) => {
      stopAudio();

      clearInterval(store.session.get('intervalId'));
      clearTimeout(store.session.get('timerId'));
      clearTimeout(store.session.get('timerIdCountdown'));

      const continueBtn = document.getElementById('jspsych-html-button-response-button-0');

      if (continueBtn) {
        continueBtn.removeEventListener('click', handleContinueClick);
      }

      const stimulus = store.session.get('nextStimulus');
      //round to prevent precision errors
      let absDifference = _round(Math.abs(data.response - stimulus.target), 3);
      let perError = _round((absDifference / stimulus.upper) * 100, 2);

      let subCorpusName = store.session.get('subCorpusName');
      jsPsych.data.addDataToLastTrial({
        subtask: 'numberLine',
        save_trial: true,
        time_out: store.session.get('timeOut'),
        pid: store.session.get('config').pid,
        corpus_name: subCorpusName,
        trial_num_block: store.session.get('indexTracking') + 1,
        item_id: stimulus.itemID,
        problem_id: stimulus.problem_ID,
        problem_version: stimulus.version,
        theoretical_difficulty: stimulus.difficulty,
        block: stimulus.block,
        correct: 1,
        abs_difference: absDifference,
        percent_error: perError,
        item: stimulus.item,
        target: stimulus.target,
        is_mobile: isMobile,
      });

      // update trial count
      /*if (corpusName === "stimulus") {
                store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);

                // feed response to fluencyValidityEvaluator for evaluation per trial
                validityEvaluator.addResponseData(
                    data.rt,
                    response_val == null ? response_val : response_val.toString(),
                    store.session.get("dataCorrect"),
                );
            }*/
    },
  };
  return stim;
};
