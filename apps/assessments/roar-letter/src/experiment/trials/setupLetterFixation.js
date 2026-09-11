import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import store from 'store2';
import { cat } from '../experimentSetup';
import { corpusTypePhonics } from '../config/corpus';

// This function is executed during the fixation trial. It fetches the corpus,
// calls the adaptive algorithm to select the next item, stores it in a session variable,
// and removes the item from the corpus
// corpusType is the name of a subTask's corpus within corpusLetterAll[]
export const getStimulusLetterName = (corpusType) => {
  // read the current version of the corpus
  const corpus = store.session.get('corpusLetterAll');

  // chose stimulus
  const itemSuggestion = cat.findNextItem(corpus[corpusType]);

  // store the item for use in the trial
  store.session.set('nextStimulus', itemSuggestion.nextStimulus);

  // update the corpus with the remaining unused items
  corpus[corpusType] = itemSuggestion.remainingStimuli;
  store.session.set('corpusLetterAll', corpus);
};

// choosing the next stimulus from the corpus occurs during the fixation trial
// prior to the actual display of the stimulus, where user response is collected
// the array allows us to use the same structure for all corpuses
const setupLetterData = [
  {
    // phonics practice
    onFinish: () => {
      getStimulusLetterName('corpusPhonicsPractice');
    },
  },
  {
    // phonics stimuli
    onFinish: () => {
      getStimulusLetterName(corpusTypePhonics);
    },
  },
];

// Is this trial just to call the functions above?
const setupLetterTrials = setupLetterData.map((trial) => ({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: function () {
    return `<div class='stimulus_div'>
                <p class='stimulus'> </p>
              </div>`;
  },
  prompt: '',
  choices: 'NO_KEYS',
  trial_duration: 10, // store.session.get("config").timing.fixationTime, // TODO fix
  data: {
    task: 'fixation',
  },
  on_finish: trial.onFinish,
}));

// for these variables, the index corresponds to trial parameter in the map(),
// i comes from the for loop that adds these to the timeline
export const setupPhonicsPracticeTrial = setupLetterTrials[0];
export const setupLetterTextSoundPseudoTrial = setupLetterTrials[1];
