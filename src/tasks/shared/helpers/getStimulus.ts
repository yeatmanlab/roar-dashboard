import _isEqual from 'lodash/isEqual';
import { mediaAssets } from '../../..';
import { camelize } from './camelize';
import { taskStore } from '../../../taskStore';
import { cat, jsPsych } from '../../taskSetup';
import { checkEndTaskEarly, getActiveTaskElapsedMs } from './appTimer';

// This function reads the corpus, calls the adaptive algorithm to select
// the next item, stores it in a session variable, and removes it from the corpus
// corpusType is the name of the subTask's corpus within corpusLetterAll[]

export const getStimulus = (corpusType: string, blockNumber?: number, storyGroup?: number, randomize = false) => {
  let corpus, itemSuggestion;

  corpus = taskStore().corpora;

  if (blockNumber != null) {
    // if block number is specified, get next item from only the indicated block of the corpus
    itemSuggestion = cat.findNextItem(corpus[corpusType][blockNumber]);
  } else if (storyGroup != null) {
    // if story group is specified (only for ToM), get next item from only the indicated story group of the corpus
    const storyGroupStimuli = corpus[corpusType].filter((stimulus: StimulusType) => stimulus.storyGroup === storyGroup);

    if (randomize) {
      const nextItem = storyGroupStimuli[Math.floor(Math.random() * storyGroupStimuli.length)];
      const remainingStimuli = corpus[corpusType].filter(
        (stimulus: StimulusType) => stimulus.itemId !== nextItem.itemId,
      );

      itemSuggestion = {
        nextStimulus: nextItem,
        remainingStimuli: remainingStimuli,
      };
    } else {
      itemSuggestion = cat.findNextItem(storyGroupStimuli);
    }
  } else {
    itemSuggestion = cat.findNextItem(corpus[corpusType]);
  }

  const stimAudio = itemSuggestion.nextStimulus.audioFile;
  if (typeof stimAudio === 'string') {
    if (stimAudio && !mediaAssets.audio[camelize(stimAudio)]) {
      console.warn('Trial skipped. Audio file not found:', stimAudio);
      taskStore('skipCurrentTrial', true);
      // ends the setup timeline
      jsPsych.endCurrentTimeline();
    }
  } else {
    const audioAssets = stimAudio.map((audio: string) => camelize(audio));
    if (audioAssets.some((audioAsset: string) => !mediaAssets.audio[audioAsset])) {
      console.warn('Trial skipped. Audio file(s) not found:', audioAssets);
      taskStore('skipCurrentTrial', true);
      // ends the setup timeline
      jsPsych.endCurrentTimeline();
    }
  }

  // end task if there is not enough time to display next stimulus
  const maxTimeInMilliseconds = taskStore().maxTime * 60000;
  const timeElapsed = getActiveTaskElapsedMs();
  const timeRemaining = maxTimeInMilliseconds - timeElapsed;

  checkEndTaskEarly(timeRemaining, stimAudio);

  // store the item for use in the trial
  taskStore('nextStimulus', itemSuggestion.nextStimulus);

  if (itemSuggestion.nextStimulus.assessmentStage === 'practice_response') {
    taskStore('testPhase', false);
  }

  // update the corpus with the remaining unused items
  blockNumber != null
    ? (corpus[corpusType][blockNumber] = itemSuggestion.remainingStimuli)
    : (corpus[corpusType] = itemSuggestion.remainingStimuli);

  taskStore('corpora', corpus);
};
