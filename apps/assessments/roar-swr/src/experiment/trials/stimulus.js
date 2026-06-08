import jsPsychHTMLMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import store from 'store2';
import { fillZetaDefaults, ensureZetaNumericValues, convertZeta } from '@bdelab/jscat';
import { isTouchScreen, updateTracker } from '../experimentSetup';
import { cat, cat2, presentationTimeCats, mediaAssets, swrValidityEvaluator } from '../experiment';
import { jsPsych } from '../jsPsych';

// Normalize any stimulus’ IRT params to {a,b,c,d} as numbers.
function buildIrtParams(stim) {
  // Pull any zeta-ish keys the item might carry (symbolic or semantic)
  const zetaLike = {
    a: stim.a,
    b: stim.b,
    c: stim.c,
    d: stim.d,
    discrimination: stim.discrimination,
    difficulty: stim.difficulty ?? stim.b, // keep old mapping safe
    guessing: stim.guessing,
    slipping: stim.slipping,
  };

  // 1) cast numeric & drop invalids
  const numeric = ensureZetaNumericValues(zetaLike);

  // 2) convert everything to symbolic keys (a,b,c,d)
  const symbolic = convertZeta(numeric, 'symbolic');

  // 3) fill defaults (a=1,b=0,c=0,d=1), still symbolic
  const withDefaults = fillZetaDefaults(symbolic, 'symbolic');

  // Ensure plain numbers
  return {
    a: Number(withDefaults.a),
    b: Number(withDefaults.b),
    c: Number(withDefaults.c),
    d: Number(withDefaults.d),
  };
}

const lexicalityTrialContent = [
  {
    stimulus: () => `
    <div class='stimulus_div'>
      <p class='stimulus'><span translate="no">${jsPsych.timelineVariable('stimulus')}</span></p>
    </div>`,
    stimulus_duration: () => {
      store.session.transact('practiceIndex', (oldVal) => oldVal + 1);
      if (store.session('practiceIndex') > store.session.get('config').countSlowPractice) {
        return store.session.get('config').timing.stimulusTime;
      }
      return store.session.get('config').timing.stimulusTimePracticeOnly;
    },
    data: {
      save_trial: true,
      assessment_stage: 'practice_response' /* tag the test trials with this taskname so we can filter data later */,
      word: () => {
        jsPsych.timelineVariable('stimulus');
      },
    },
    on_finish: (data) => {
      const correctResponse = jsPsych.timelineVariable('correct_response');

      if (data.keyboard_response) {
        // eslint-disable-next-line no-param-reassign
        data.correct = jsPsych.pluginAPI.compareKeys(data.keyboard_response, correctResponse);
      } else if (correctResponse === 'ArrowLeft' && data.button_response === 0) {
        // eslint-disable-next-line no-param-reassign
        data.correct = true;
      } else if (correctResponse === 'ArrowRight' && data.button_response === 1) {
        // eslint-disable-next-line no-param-reassign
        data.correct = true;
      } else {
        // eslint-disable-next-line no-param-reassign
        data.correct = false;
      }

      if (data.correct) {
        store.session.set('response', 1);
      } else {
        store.session.set('response', 0);
      }
      store.session.set('currentTrialCorrect', data.correct);

      const isLeftResponse = data.keyboard_response === 'arrowleft' || data.button_response === 0;
      store.session.set('responseLR', isLeftResponse ? 'left' : 'right');
      store.session.set('answerRP', isLeftResponse ? 'made-up' : 'real');
      store.session.set('responseColor', isLeftResponse ? 'orange' : 'blue');

      const isLeftAnswer = jsPsych.timelineVariable('correct_response') === 'ArrowLeft';
      store.session.set('correctLR', isLeftAnswer ? 'left' : 'right');
      store.session.set('correctRP', isLeftAnswer ? 'made-up' : 'real');
      store.session.set('answerColor', isLeftAnswer ? 'orange' : 'blue');

      jsPsych.data.addDataToLastTrial({
        correct: store.session('response'),
        correctResponse: jsPsych.timelineVariable('correct_response'),
        realpseudo: jsPsych.timelineVariable('realpseudo'),
        block: 'Practice',
        corpusId: 'Practice',
        trialNumPractice: store.session('practiceIndex'),
        pid: store.session.get('config').pid,
        language: store.session.get('config').language,
        audioFeedback: store.session.get('config').audioFeedback,
      });

      jsPsych.setProgressBar(0);
    },
  },
  {
    stimulus: () => `
    <div class='stimulus_div'>
      <p id="stimulus-word" class='stimulus'><span translate="no">
        ${store.session('nextStimulus').stimulus}
      </span></p>
    </div>`,
    stimulus_duration: () => {
      const config = store.session.get('config');
      const { userMode } = config;
      let presentationTime = config.timing.stimulusTime;

      if (['presentationExp', 'presentationExpShort', 'presentationExp2Conditions'].includes(userMode)) {
        presentationTime = store.session.get('nextStimulus').presentationTime;
      } else if (userMode === 'shortAdaptiveEasyBlock' && store.session.get('currentBlockIndex') === 0) {
        presentationTime = null;
      }

      store.session.set('presentationTime', presentationTime);
      return presentationTime;
    },
    data: {
      save_trial: true,
      assessment_stage: 'test_response' /* tag the test trials with this taskname so we can filter data later */,
    },
    on_finish: (data) => {
      const nextStimulus = store.session('nextStimulus');

      if (data.keyboard_response) {
        // eslint-disable-next-line no-param-reassign
        data.correct = jsPsych.pluginAPI.compareKeys(data.keyboard_response, nextStimulus.correct_response);
      } else if (nextStimulus.correct_response === 'ArrowLeft' && data.button_response === 0) {
        // eslint-disable-next-line no-param-reassign
        data.correct = true;
      } else if (nextStimulus.correct_response === 'ArrowRight' && data.button_response === 1) {
        // eslint-disable-next-line no-param-reassign
        data.correct = true;
      } else {
        // eslint-disable-next-line no-param-reassign
        data.correct = false;
      }

      store.session.set('currentTrialCorrect', data.correct);

      if (data.correct) {
        store.session.set('response', 1);
      } else {
        store.session.set('response', 0);
      }

      /* if presentation exp:
      add presentation time 160ms and 350ms for formal theta update: cat -> thetaEstimate
      add all stimuli for theta update: cat2 -> thetaEstimate2
      add presentation time specific theta update: presentationTimeCats -> thetaEstimate3
       */

      const experimentalUserModes = ['presentationExp', 'presentationExpShort', 'presentationExp2Conditions'];
      const { presentationTime, corpus_src } = nextStimulus;
      const irtParameters = buildIrtParams(nextStimulus);
      if (experimentalUserModes.includes(store.session.get('config').userMode)) {
        const kitten = presentationTimeCats?.[presentationTime];
        if (kitten) kitten.updateAbilityEstimate(irtParameters, store.session('response'));

        // Update CAT estimate for specific presentation times
        if ([160, 350].includes(presentationTime)) {
          cat.updateAbilityEstimate(irtParameters, store.session('response'));
        }
      } else if (!['corpusNew', 'en-corpusNew-easy'].includes(corpus_src)) {
        // Update CAT estimate for validated corpus items only
        cat.updateAbilityEstimate(irtParameters, store.session('response'));
      }

      // update cat2 as long as params are present
      cat2.updateAbilityEstimate(irtParameters, store.session('response'));

      // Add the keyboard response if in keyboard mode, else add the button_response for touch screen mode
      swrValidityEvaluator.addResponseData(
        data.rt,
        data.keyboard_response ? data.keyboard_response : data.button_response,
        store.session('response'),
      );

      jsPsych.data.addDataToLastTrial({
        block: store.session('currentBlockIndex'),
        corpusId: nextStimulus.corpus_src,
        word: nextStimulus.stimulus,
        correct: store.session('response'),
        correctResponse: nextStimulus.correct_response,
        responseInput: data.keyboard_response ? 'keyboard' : 'touch',
        realpseudo: nextStimulus.realpseudo,
        difficulty: nextStimulus.difficulty,
        thetaEstimate: cat.theta,
        thetaSE: cat.seMeasurement === Infinity ? Number.MAX_VALUE : cat.seMeasurement,
        thetaEstimate2: cat2.theta,
        thetaSE2: cat2.seMeasurement === Infinity ? Number.MAX_VALUE : cat2.seMeasurement,
        stimulusRule: store.session('itemSelect'),
        trialNumTotal: store.session('trialNumTotal'),
        trialNumBlock: store.session('trialNumBlock'),
        pid: store.session.get('config').pid,
        language: store.session.get('config').language,
        audioFeedback: store.session.get('config').audioFeedback,
        stimulusPresentationTime: store.session('presentationTime') ? store.session('presentationTime') : 'infinite',
      });

      // update cat3 only in experimental presentation modes
      if (
        store.session.get('config').userMode === 'presentationExp' ||
        store.session.get('config').userMode === 'presentationExpShort' ||
        store.session.get('config').userMode === 'presentationExp2Conditions'
      ) {
        jsPsych.data.addDataToLastTrial({
          thetaEstimate3: presentationTimeCats[nextStimulus.presentationTime].theta, // presentation specific
          thetaSE3:
            presentationTimeCats[nextStimulus.presentationTime].seMeasurement === Infinity
              ? Number.MAX_VALUE
              : presentationTimeCats[nextStimulus.presentationTime].seMeasurement, // presentation specific
        });
      }

      const config = store.session.get('config');

      const currProgressBar = jsPsych.getProgressBarCompleted();
      jsPsych.setProgressBar(currProgressBar + 1 / config.stimulusCountList.reduce((_a, _b) => _a + _b, 0));

      updateTracker();
    },
  },
];

// eslint-disable-next-line no-unused-vars
const lexicalityTrialsMapped = lexicalityTrialContent.map((trial) => ({
  type: jsPsychHTMLMultiResponse,
  stimulus: trial.stimulus,
  prompt: () => (!isTouchScreen ? `<img class="lower" src="${mediaAssets.images.arrowkeyLex}" alt = "arrow-key">` : ''),
  stimulus_duration: trial.stimulus_duration,
  trial_duration: () => store.session.get('config').timing.trialTime,
  keyboard_choices: () =>
    store.session.get('config').addNoResponse ? ['ArrowLeft', 'ArrowRight', ' '] : ['ArrowLeft', 'ArrowRight', ''],
  button_choices: () => (isTouchScreen ? ['ArrowLeft', 'ArrowRight'] : []),
  // eslint-disable-next-line consistent-return
  button_html: () => {
    if (isTouchScreen) {
      return [
        `<button class="lexicality-trial-arrows">
                    <img class='btn-arrows' src=${mediaAssets.images.staticLeftKey} alt='left arrow' />
                    </button>`,
        `<button class="lexicality-trial-arrows">
                    <img class='btn-arrows' src=${mediaAssets.images.staticRightKey} alt='right arrow' />
                    </button>`,
      ];
    }
  },
  data: trial.data,
  on_load: () => {
    if (isTouchScreen) {
      document.getElementById('jspsych-html-multi-response-button-0').style.margin = '0rem 5rem 0rem 5rem';
      document.getElementById('jspsych-html-multi-response-button-1').style.margin = '0rem 5rem 0rem 5rem';
    }
  },
  on_finish: trial.on_finish,
}));

export const leixcalityPractice = lexicalityTrialsMapped[0];
export const lexicalityTest = lexicalityTrialsMapped[1];
