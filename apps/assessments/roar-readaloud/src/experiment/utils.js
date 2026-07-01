import jsPsychHtmlButtonResponse from "@jspsych/plugin-html-button-response";
import jsPsychHtmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";

// Session storage
import store from "store2";

// Local imports
import { config, jsPsych } from "./config";
import { nStimuli } from "./corpus";
import { audioContent, characters } from "./preload";

const buttonHtml =
  '<button class="jspsych-btn" type="button"><img draggable="false" src="%choice%" width="100%" height="100%"/></button>';

const updateProgressBar = () => {
  const curr_progress_bar_value = jsPsych.getProgressBarCompleted();
  jsPsych.setProgressBar(curr_progress_bar_value + 1 / nStimuli);
};

const styleOpacity = (opacity) => `opacity: ${opacity};`;
const styleText = (opacity) => `style="${styleOpacity(opacity)}"`;

export const buildStimulusHtml = (stimuli, opacity = 1.0) => {
  let outputHtml = '<div class="center">';
  const stimLength = stimuli.length;
  stimuli.forEach((stimulus, index) => {
    if (index !== Math.floor(stimLength / 2)) {
      outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" ${styleText(
        opacity,
      )} />`;
    } else {
      outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" />`;
    }
  });
  outputHtml += "</div>";
  return outputHtml;
};

export const buildLocationCueHtml = (
  stimLength,
  correctResponseIdx,
  preCueLocation = null,
  opacity = 1.0,
) => {
  let outputHtml = '<div class="center">';
  const stimuli = Array(stimLength).fill(characters["white.svg"]);
  stimuli.splice(Math.floor(stimLength / 2), 1, characters["plus.svg"]);
  // If preCueLocation is null, assume this is the post stimulus location cue trial
  if (preCueLocation === null) {
    stimuli.forEach((stimulus, index) => {
      if (index === correctResponseIdx) {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus bottom-border-blue" ${styleText(
          opacity,
        )} />`;
      } else if (index !== Math.floor(stimLength / 2)) {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" ${styleText(
          opacity,
        )} />`;
      } else {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" />`;
      }
    });
  } else if (preCueLocation === "left") {
    stimuli.forEach((stimulus, index) => {
      if (index < Math.floor(stimLength / 2)) {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus bottom-border-red" ${styleText(
          opacity,
        )} />`;
      } else if (index !== Math.floor(stimLength / 2)) {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" ${styleText(
          opacity,
        )} />`;
      } else {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" />`;
      }
    });
  } else if (preCueLocation === "right") {
    stimuli.forEach((stimulus, index) => {
      // Here we condition upon greater than half, rather than greater than or
      // equal to because we incremented the length of the stimuli array above
      // by adding the plus sign.
      if (index > Math.floor(stimLength / 2)) {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus bottom-border-red" ${styleText(
          opacity,
        )} />`;
      } else if (index !== Math.floor(stimLength / 2)) {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" ${styleText(
          opacity,
        )} />`;
      } else {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" />`;
      }
    });
  } else if (preCueLocation === "both") {
    stimuli.forEach((stimulus, index) => {
      if (index !== Math.floor(stimLength / 2)) {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus bottom-border-red" ${styleText(
          opacity,
        )} />`;
      } else {
        outputHtml += `<img draggable="false" src="${stimulus}" class="mep-stimulus" />`;
      }
    });
  }
  outputHtml += "</div>";
  return outputHtml;
};

export const makeRoarTrial = ({
  fixation,
  stimulus,
  isPractice,
  preCue,
  dots,
  opacity = 1.0,
}) => {
  const timeline = [];

  const fixationTrial = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: buildStimulusHtml(
      [stimulus.source[Math.floor(stimulus.source.length / 2)]],
      1.0,
    ),
    choices: "NO_KEYS",
    stimulus_duration: null,
    trial_duration: fixation.duration,
    data: {
      task: "fixation",
      fixation_duration: fixation.duration,
    },
  };
  timeline.push(fixationTrial);

  if (preCue) {
    const preCueTrial = {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: buildLocationCueHtml(
        stimulus.source.length,
        stimulus.cueLocationIdx,
        stimulus.preCueLocation,
        1.0,
      ),
      choices: "NO_KEYS",
      stimulus_duration: null,
      trial_duration: stimulus.preCueDuration,
      data: {
        task: "pre_cue",
      },
    };
    timeline.push(preCueTrial);

    const cueToTargetIntervalTrial = {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: buildStimulusHtml(
        [stimulus.source[Math.floor(stimulus.source.length / 2)]],
        1.0,
      ),
      choices: "NO_KEYS",
      stimulus_duration: null,
      trial_duration: stimulus.cueToTargetInterval,
      data: {
        task: "cue_to_target_interval",
      },
    };
    timeline.push(cueToTargetIntervalTrial);
  }

  let start_time;
  let recorded_stimulus_duration;

  const record_stimulus_duration = () => {
    if (!start_time) {
      // on_start callback
      start_time = new Date();
    } else {
      // on_finish callback
      recorded_stimulus_duration = new Date() - start_time;
      start_time = undefined;
    }
  };

  const stimulusTrial = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: buildStimulusHtml(stimulus.source, opacity),
    choices: "NO_KEYS",
    stimulus_duration: null,
    trial_duration: stimulus.stimulusDuration,
    data: {
      task: "stimulus",
    },
    on_start: record_stimulus_duration,
    on_finish: record_stimulus_duration,
  };
  timeline.push(stimulusTrial);

  if (!dots) {
    const locationCueTrial = {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: buildLocationCueHtml(
        stimulus.source.length,
        stimulus.cueLocationIdx,
        null,
        opacity,
      ),
      choices: "NO_KEYS",
      stimulus_duration: null,
      trial_duration: stimulus.cueDuration,
      data: {
        task: "location_cue",
      },
    };
    timeline.push(locationCueTrial);
  }

  let responseStimulus;
  if (dots) {
    responseStimulus = buildStimulusHtml(
      [stimulus.source[Math.floor(stimulus.source.length / 2)]],
      opacity,
    );
  } else {
    responseStimulus = buildLocationCueHtml(
      stimulus.source.length,
      stimulus.cueLocationIdx,
      null,
      opacity,
    );
  }

  const responseTrial = {
    type: jsPsychHtmlButtonResponse,
    stimulus: responseStimulus,
    choices: stimulus.choices,
    button_html: buttonHtml,
    data: {
      task: isPractice ? "practice_response" : "test_response",
      isPseudoSloan: config.pseudoFont,
      isGeneric: config.dots,
      stimulusString: stimulus.stimulusString,
      choicesString: stimulus.choicesString,
      cueLocationIdx: stimulus.cueLocationIdx,
      correctResponse: stimulus.correctResponse,
      correctResponseIdx: stimulus.correctResponseIdx,
      urlQueryString: config.urlParams.toString(),
    },
    margin_vertical: "inherit",
    margin_horizontal: "inherit",
    response_ends_trial: true,
    on_finish: function (data) {
      updateProgressBar();
      // eslint-disable-next-line no-param-reassign
      data.pid = store.session("pid");
      // eslint-disable-next-line no-param-reassign
      data.correct = data.response === stimulus.correctResponseIdx;
      // eslint-disable-next-line no-param-reassign
      data.recorded_stimulus_duration = recorded_stimulus_duration;

      if (data.correct) {
        new Audio(audioContent.feedbackCorrect).play();
      } else {
        new Audio(audioContent.feedbackIncorrect).play();
      }
    },
  };

  timeline.push(responseTrial);

  return timeline;
};
