import store from 'store2';
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import i18next from 'i18next';

const initStore = () => {
  if (store.session.has('initialized') && store.local('initialized')) {
    return store.session;
  }

  store.session.set('itemSelect', 'random');

  // Counting variables
  store.session.set('practiceIndex', 0);
  store.session.set('currentBlockIndex', 0); // counter for breaks within subtask

  store.session.set('trialNumSubtask', 0); // counter for trials in subtask
  store.session.set('trialNumTotal', 0); // counter for trials in experiment

  // variables to track current state of the experiment
  store.session.set('currentTrialCorrect', true);

  // running computations
  store.session.set('subtaskCorrect', 0);
  store.session.set('totalCorrect', 0);
  store.session.set('correctItems', []);
  store.session.set('incorrectItems', []);

  store.session.set('initialized', true);
};

export const initConfig = async (gameParams, userParams, session = {}) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  const {
    userMetadata = {},
    audioFeedback,
    language = i18next.language ?? 'en',
    skipInstructions,
    practiceCorpus,
    stimulusCorpus,
    sequentialPractice,
    sequentialStimulus,
    buttonLayout,
    numberOfTrials,
    storyCorpus,
    taskName,
    stimulusBlocks,
    numOfPracticeTrials,
    story,
    keyHelpers,
  } = cleanParams;

  language !== 'en' && i18next.changeLanguage(language);

  const config = {
    userMetadata: { ...userMetadata },
    audioFeedback: audioFeedback || 'neutral',
    skipInstructions: skipInstructions ?? true,
    startTime: new Date(),
    // Raw variant params — views read config.variantParams.* (was config.firekit.task.variantParams.*).
    variantParams: gameParams,
    // Injected client-side identifiers — were config.firekit.user.* (assessmentPid is the lab
    // participant-name string from the URL, not the ROAR participantId).
    assessmentPid: session.assessmentPid ?? '',
    assessmentUid: session.assessmentUid ?? '',
    displayElement: session.displayElement ?? null,
    // name of the csv files in the storage bucket
    practiceCorpus: practiceCorpus ?? 'math-item-bank-practice-pz',
    stimulusCorpus: stimulusCorpus ?? 'math-item-bank-pz',
    sequentialPractice: sequentialPractice ?? true,
    sequentialStimulus: sequentialStimulus ?? true,
    buttonLayout: buttonLayout || 'default',
    numberOfTrials: numberOfTrials ?? 10,
    storyCorpus: storyCorpus ?? 'story-lion',
    task: taskName ?? 'roar-readaloud',
    stimulusBlocks: stimulusBlocks ?? 3,
    numOfPracticeTrials: numOfPracticeTrials ?? 2,
    story: story ?? false,
    keyHelpers: keyHelpers ?? true,
  };

  return config;
};

initStore();
