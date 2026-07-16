import jsPsychCallFunction from '@jspsych/plugin-call-function';

export const wrapAsJsPsychTrial = (fn) => ({
  type: jsPsychCallFunction,
  func: fn,
});
