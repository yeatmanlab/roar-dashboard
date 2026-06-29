// Required to use top level await
import 'regenerator-runtime/runtime';
import '../../../i18n/i18n';
import _shuffle from 'lodash/shuffle';
import Papa from 'papaparse';
import _compact from 'lodash/compact';
import _toNumber from 'lodash/toNumber';
import { stringToNumberArray } from './stringToNumArray';
import { camelize } from './camelize';
import { shuffleStimulusTrials } from './randomizeStimulusBlocks';
import { shuffleStories } from '../../roar-inference/helpers/shuffleRoarInferenceStories';
import { taskStore } from '../../../taskStore';
import { getBucketName } from './getBucketName';
import { getChildSurveyResponses } from './childSurveyResponses';
import { shouldUseClowder } from './shouldUseClowder';

type ParsedRowType = {
  source: string;
  block_index: string;
  task: string;
  prompt: string;
  item: string | number[];
  origItemNum: string;
  orig_item_num: string;
  trialType: string;
  image: string | string[];
  timeLimit: string;
  answer: string | number;
  assessmentStage: string;
  chanceLevel: number;
  itemId: string;
  distractors: number[] | string[];
  audioFile: string | string[];
  // difficulty must be undefined to avoid running cat
  difficulty: string;
  d: string;
  trial_type: string;
  required_selections: string;
  requiredSelections?: number;
  time_limit: string;
  assessment_stage: string;
  chance_level: string;
  item_id: string;
  item_uid: string;
  response_alternatives: string;
  audio_file: string | string[];
  randomize?: string;
  trial_num: number;
  downex?: string;
  block_threshold?: number;
  story_group?: number;
};

let totalTrials = 0;
let totalDownexTrials = 0;

let stimulusData: StimulusType[] = [];
let downexData: StimulusType[] = [];

function writeItem(row: ParsedRowType) {
  if (row.task === 'math' && row.trial_type.includes('Number Line')) {
    const splitArr = (row.item as string).split(',');
    return splitArr.map((el) => _toNumber(el));
  }

  return row.item;
}

function containsLettersOrSlash(str: string) {
  return /[a-zA-Z\/]/.test(str);
}

const transformCSV = (csvInput: ParsedRowType[], sequentialStimulus: boolean, task: string) => {
  let currTrialTypeBlock = '';
  let currPracticeAmount = 0;

  const blockThresholds: number[] = [];

  csvInput.forEach((row) => {
    // Leaving this here for quick testing of a certain type of trial
    // if (!row.trial_type.includes('Number Line')) return;

    if (row.block_threshold && !blockThresholds.includes(row.block_threshold)) {
      blockThresholds.push(row.block_threshold);
    }

    const newRow: StimulusType = {
      source: row.source,
      block_index: parseInt(row.block_index),
      task: row.task,
      // for testing, will be removed
      prompt: row.prompt,
      item: writeItem(row),
      origItemNum: row.orig_item_num,
      trialType: row.trial_type,
      image: row?.image?.includes(',') ? (row.image as string).replace(' ', '').split(',') : row?.image,
      timeLimit: row.time_limit,
      answer: _toNumber(row.answer) || row.answer,
      assessmentStage: row.assessment_stage,
      chanceLevel: _toNumber(row.chance_level),
      itemId: row.item_id,
      itemUid: row.item_uid,
      distractors: (() => {
        if (row.task === 'roar-inference') {
          return row.response_alternatives.split(',').map((alt) => alt.replace(/"/g, ''));
        } else if (row.task === 'child-survey') {
          return getChildSurveyResponses();
        } else {
          return containsLettersOrSlash(row.response_alternatives) ||
            (row.task === 'adult-reasoning' && row.response_alternatives.includes(';'))
            ? row.response_alternatives.split(',')
            : stringToNumberArray(row.response_alternatives);
        }
      })(),
      audioFile: row.audio_file?.includes(',') ? (row.audio_file as string).split(',') : (row.audio_file as string),
      // difficulty must be undefined to avoid running cat
      difficulty: taskStore().runCat ? parseFloat(row.d || row.difficulty) : NaN,
      randomize: row.randomize as 'yes' | 'no' | 'at_block_level',
      trialNumber: row.trial_num,
      downex: row.downex?.toUpperCase() === 'TRUE',
      storyGroup: _toNumber(row.story_group),
    };

    if (row.task === 'same-different-selection') {
      newRow.requiredSelections = _toNumber(row.required_selections);
    }

    if (row.task === 'Mental Rotation') {
      newRow.item = camelize(newRow.item as string);
      newRow.answer = camelize(newRow.answer as string);
      newRow.distractors = (newRow.distractors as string[]).map((choice) => camelize(choice));
    }

    if (row.task === 'same-different-selection') {
      newRow.requiredSelections = parseInt(row.required_selections);
    }

    let currentTrialType = newRow.trialType;
    if (currentTrialType !== currTrialTypeBlock) {
      currTrialTypeBlock = currentTrialType;
      currPracticeAmount = 0;
    }

    // Add cat values for clowder
    if (shouldUseClowder()) {
      // catZeta columns always includes a period delimiter
      const catZetas = Object.fromEntries(Object.entries(row).filter(([key]) => key.includes('.')));

      Object.assign(newRow, catZetas);
    }

    if (newRow.downex) {
      // Add to downex corpus
      downexData.push(newRow);
      totalDownexTrials += 1;
    } else {
      // Add to stimulus corpus
      stimulusData.push(newRow);
      totalTrials += 1;
    }
  });

  taskStore(
    'blockThresholds',
    blockThresholds.sort((a, b) => a - b),
  );

  // Only shuffle if unnormed scoring is enabled. Otherwise, Clowder handles the randomization.
  if (task === 'roar-inference' && !taskStore().scoringVersion) {
    const inferenceNumStories = taskStore().inferenceNumStories;
    const numItemsPerStory = taskStore().stimulusBlocks;
    const notStoryTypes = ['introduction', 'practice'];
    stimulusData = shuffleStories(stimulusData, inferenceNumStories, 'itemId', notStoryTypes, numItemsPerStory);
    return;
  }

  if (!sequentialStimulus) {
    stimulusData = shuffleStimulusTrials(stimulusData);
    if (downexData.length > 0) {
      downexData = shuffleStimulusTrials(downexData);
    }
  }
};

export const getCorpus = async (config: Record<string, any>, isDev: boolean) => {
  const { corpus, task, sequentialStimulus } = config;

  // Temporarily keep these here for backward compatibility
  /*const corpusLocation = {
    egmaMath: `https://storage.googleapis.com/${task}/shared/corpora/${corpus}.csv`,
    matrixReasoning: `https://storage.googleapis.com/${task}/shared/corpora/${corpus}.csv`,
    mentalRotation: `https://storage.googleapis.com/${task}/shared/corpora/${corpus}.csv`,
    sameDifferentSelection: `https://storage.googleapis.com/${task}/shared/corpora/${corpus}.csv`,
    trog: `https://storage.googleapis.com/roar-syntax/shared/corpora/${corpus}.csv`,
    theoryOfMind: `https://storage.googleapis.com/${task}/shared/corpora/${corpus}.csv`,
    vocab: `https://storage.googleapis.com/vocab-test/shared/corpora/${corpus}.csv`,
    roarInference: `https://storage.googleapis.com/roar-inference/en/corpora/${corpus}.csv`,
    adultReasoning: `https://storage.googleapis.com/egma-math/shared/corpora/${corpus}.csv`,
  };*/

  const bucketName = getBucketName(task, isDev, 'corpus');

  let corpusUrl = `https://storage.googleapis.com/${bucketName}/${corpus}.csv?alt=media`;

  // Default corpuses are CAT and norm compatible (v1)
  if (task === 'roar-inference') {
    // ROAR buckets are organized by base language code (en, es, de), not the full locale
    const language = (config.language ?? 'en').split('-')[0];
    corpusUrl = `https://storage.googleapis.com/roar-inference/${language}/corpora/${corpus}.csv`;
  } else if (task === 'trog') {
    corpusUrl = `https://storage.googleapis.com/roar-syntax/shared/corpora/${corpus}.csv`;
  }

  function downloadCSV(url: string) {
    return new Promise((resolve, reject) => {
      Papa.parse<ParsedRowType>(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          transformCSV(results.data, sequentialStimulus, task);
          resolve(results.data);
        },
        error: function (error) {
          reject(error);
        },
      });
    });
  }

  async function parseCSVs(urls: string[]) {
    const promises = urls.map((url, i) => downloadCSV(url));
    return Promise.all(promises);
  }

  async function fetchData() {
    // const urls = [corpusLocation[dashToCamelCase(task) as keyof typeof corpusLocation]];
    const urls = [corpusUrl];
    try {
      await parseCSVs(urls);
      taskStore('totalTrials', totalTrials);
      taskStore('totalDownexTrials', totalDownexTrials);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  await fetchData();

  const csvTransformed = {
    stimulus: stimulusData, // previously shuffled by shuffleStimulusTrials
    downex: downexData,
  };

  taskStore('corpora', csvTransformed);
};
