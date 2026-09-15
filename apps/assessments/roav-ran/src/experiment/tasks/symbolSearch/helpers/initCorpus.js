import { stimulusArray } from '../stimulusInfo';
import store from 'store2';
import itemsPractice from '../practice.csv';
import { imageAssetsDir } from '../imageAssets';

//randomly shuffle array, chooses random index for each element and swaps
const shuffle = (array) => {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

    // swap elements array[i] and array[j]
    // use "destructuring assignment" syntax
    // eslint-disable-next-line no-param-reassign
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
};

/**
 * This function generates the target positions for a given number of trials.
 * The possible set of target positions = [0, 1, 2, ... numPositions-1]
 *
 * Until the required number of target positions are generated:
 * 1. Randomly shuffle the possible set of target positions.
 * 2. Appends this set of shuffled positions to the final set of target positions, only if the first target in the new sequence is not equal to the last target of the previous sequence. This is to prevent target positions from repeating across consecutive trials.
 *
 * This logic allows an approximately uniform distribution of all target positions, without random sampling issues which may appear as a result of small number of trials. Since some students may not be able to do many trials within the given time.
 *
 * @param {number} numTrials - Number of trials to generate target positions for.
 * @param {number} numPositions - Number of possible target positions.
 * @returns {number[]} Array of target positions
 */
function generateTargetSeq(numTrials, numPositions) {
  // possible set of target positions
  const base = Array.from({ length: numPositions }, (_, i) => i);

  const sequence = [];
  let lastPos = null;

  while (sequence.length < numTrials) {
    //randomly shuffle the possible set of target positions
    const block = shuffle([...base]);

    //prevent first position of sequence being equal to last position of previous sequence
    if (lastPos !== null && block[0] === lastPos) {
      const swapIdx = 1 + Math.floor(Math.random() * (block.length - 1));
      [block[0], block[swapIdx]] = [block[swapIdx], block[0]];
    }

    sequence.push(...block);
    lastPos = block[block.length - 1];
  }
  //sequence length will be a multiples of (numPositions+1), so remove values from the end to get the desired number of target positions
  return sequence.slice(0, numTrials);
}

/**
 * This function randomly generates trials and assigns the required parameters for each trial.
 * For each trial the choices are shuffled such that the target image is not equal on consecutive trials.
 *
 * @param {number} numTrials - Number of trials to be generated
 * @returns {Object[]} Array containing trials
 */
const generateTrials = (numTrials) => {
  let corpus = [];
  let prevTarget = null;

  //generate target sequence
  let targetSeq = generateTargetSeq(numTrials, stimulusArray.length);
  for (let i = 0; i < numTrials; i++) {
    let shuffledStimulus;
    let targetIdx;
    let target;

    do {
      //randomise stimulus array
      shuffledStimulus = shuffle(stimulusArray);
      targetIdx = targetSeq[i];
      target = shuffledStimulus[targetIdx];
    } while (prevTarget !== null && target === prevTarget);

    prevTarget = target;

    let trial = {
      choices: shuffledStimulus,
      correctResponseNum: targetIdx,
      target: target,
      distractors: shuffledStimulus.filter((item) => item !== target),
      dir: imageAssetsDir,
    };
    corpus.push(trial);
  }
  return corpus;
};

// generate the corpus
export const fetchAndParseCorpus = async (config) => {
  let instruction = [];
  let practice = [];
  let test = [];

  //get practice and instruction trials
  if (!itemsPractice || itemsPractice.length === 0) {
    console.error('No practice items loaded - check data source');
    throw new Error('Practice items are required but missing');
  } else {
    for (let i = 0; i < itemsPractice.length; i++) {
      const newRow = {
        choices: itemsPractice[i].choices.split(', '),
        correctResponseNum: parseInt(itemsPractice[i].correctResponseNum),
        dir: itemsPractice[i].dir,
        distractors: itemsPractice[i].distractors.split(', '),
        target: itemsPractice[i].target,
      };
      if (itemsPractice[i].type === 'instruction') {
        instruction.push(newRow);
      } else {
        practice.push(newRow);
      }
    }
  }

  for (let i = 0; i < store.session.get('numBlocks'); i++) {
    test.push(generateTrials(config.numberOfTrials));
  }

  let corpusAll = {
    instruction: instruction,
    practice: practice,
    stimulus: test,
  };
  store.session.set('corpusAll', corpusAll);

  return corpusAll;
};
