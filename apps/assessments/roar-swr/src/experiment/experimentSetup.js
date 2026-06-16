import store from 'store2';
import { getDevice } from '@bdelab/roar-utils';
import { cat } from './experiment';

export const isTouchScreen = getDevice() === 'mobile';

const checkRealPseudo = (corpus) => {
  let corpusType = Math.random() < 0.5 ? 'corpus_real' : 'corpus_pseudo';
  const currentCorpus = corpus[corpusType];
  if (currentCorpus.length < 1) {
    if (corpusType === 'corpus_pseudo') {
      corpusType = 'corpus_real';
    } else {
      corpusType = 'corpus_pseudo';
    }
  }
  return corpusType;
};

export const getStimulus = () => {
  // decide which corpus to use
  const demoCounter = store.session('demoCounter');
  let corpus;
  let corpusType;
  let itemSuggestion;
  const currentBlockIndex = store.session('currentBlockIndex');
  const { userMode, stimulusRuleList } = store.session.get('config');
  const currentItemSelectionRule = stimulusRuleList[currentBlockIndex];
  if (
    userMode === 'presentationExp' ||
    userMode === 'presentationExpShort' ||
    userMode === 'presentationExp2Conditions'
  ) {
    corpus = store.session('corpusExperiment');

    store.session.set('itemSelect', currentItemSelectionRule);

    itemSuggestion = cat.findNextItem(corpus[currentBlockIndex], currentItemSelectionRule);
    store.session.set('nextStimulus', itemSuggestion.nextStimulus);
    corpus[currentBlockIndex] = itemSuggestion.remainingStimuli;
    store.session.set('corpusExperiment', corpus);
  } else if (['shortAdaptiveEasyBlock', 'adaptiveTimingMultiStage'].includes(userMode)) {
    // Set corpus and corpus key based on block index
    const corpusKey = currentBlockIndex === 0 ? 'corpusNewEasy' : 'corpusAll';
    corpus = store.session.get(corpusKey);

    // Set corpus type and selection rule
    corpusType = checkRealPseudo(corpus);
    store.session.set('itemSelect', currentItemSelectionRule);

    // Get the next item suggestion and update next stimulus
    itemSuggestion = cat.findNextItem(corpus[corpusType], currentItemSelectionRule);
    store.session.set('nextStimulus', itemSuggestion.nextStimulus);
    corpus[corpusType] = itemSuggestion.remainingStimuli;

    // Update the corpus in the session
    store.session.set(corpusKey, corpus);
  } else if (userMode === 'shortAdaptive' || userMode === 'longAdaptive' || userMode === 'demo') {
    if (demoCounter !== store.session.get('config').adaptive2new) {
      // validated corpus
      corpus = store.session('corpusAll');
      corpusType = checkRealPseudo(corpus);
      store.session.set('itemSelect', currentItemSelectionRule);
      itemSuggestion = cat.findNextItem(corpus[corpusType], currentItemSelectionRule);
      store.session.transact('demoCounter', (oldVal) => oldVal + 1);
      // update next stimulus
      store.session.set('nextStimulus', itemSuggestion.nextStimulus);
      corpus[corpusType] = itemSuggestion.remainingStimuli;
      store.session.set('corpusAll', corpus);
    } else {
      // new corpus needs to be randomly sampled
      corpus = store.session('corpusNew');
      corpusType = checkRealPseudo(corpus);
      store.session.set('itemSelect', 'random');
      itemSuggestion = cat.findNextItem(corpus[corpusType], 'random');
      store.session.set('demoCounter', 0);
      // update next stimulus
      store.session.set('nextStimulus', itemSuggestion.nextStimulus);
      corpus[corpusType] = itemSuggestion.remainingStimuli;
      store.session.set('corpusNew', corpus);
    }
  } else if (userMode === 'fullItemBank') {
    // new corpus
    if (store.session.get('config').indexArray[store.session('trialNumTotal')] === 0) {
      // new corpus
      corpus = store.session('corpusNew');
      corpusType = checkRealPseudo(corpus);
      itemSuggestion = cat.findNextItem(corpus[corpusType]);
      // update next stimulus
      store.session.set('nextStimulus', itemSuggestion.nextStimulus);
      corpus[corpusType] = itemSuggestion.remainingStimuli;
      store.session.set('corpusNew', corpus);
    } else {
      // validated corpus
      corpus = store.session('corpusOriginal');
      corpusType = checkRealPseudo(corpus);
      itemSuggestion = cat.findNextItem(corpus[corpusType]);
      // update next stimulus
      store.session.set('nextStimulus', itemSuggestion.nextStimulus);
      corpus[corpusType] = itemSuggestion.remainingStimuli;
      store.session.set('corpusOriginal', corpus);
    }
  } else {
    corpus = store.session('corpusAll');
    corpusType = checkRealPseudo(corpus);
    itemSuggestion = cat.findNextItem(corpus[corpusType]);
    // update next stimulus
    store.session.set('nextStimulus', itemSuggestion.nextStimulus);
    corpus[corpusType] = itemSuggestion.remainingStimuli;
    store.session.set('corpusAll', corpus);
  }
};

export const updateTracker = () => {
  const tracker = store.session('trialNumBlock');
  const currentBlockIndex = store.session('currentBlockIndex');

  if (tracker === store.session.get('stimulusCountList')[currentBlockIndex]) {
    store.session.set('trialNumBlock', 1);
  } else {
    store.session.transact('trialNumBlock', (oldVal) => oldVal + 1);
  }
  store.session.transact('trialNumTotal', (oldVal) => oldVal + 1);
};
