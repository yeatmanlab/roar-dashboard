/* eslint-disable no-plusplus */
import i18next from 'i18next';
// eslint-disable-next-line import/no-duplicates
import '../i18n';
// eslint-disable-next-line import/no-duplicates
import Papa from 'papaparse';
import store from 'store2';
import { shuffle } from '../helperFunctions';
// eslint-disable-next-line import/no-duplicates
import { multichoiceCorpus } from '../i18n';
import 'regenerator-runtime/runtime';

// eslint-disable-next-line import/no-mutable-exports
export let corpora;

// eslint-disable-next-line import/no-mutable-exports
export let storyActive;

let maxStimlulusTrials = 0;

const transformCSV = (csvInput, isPractice) =>
  csvInput.reduce((accum, row) => {
    const newRow = {
      item: row.item || row.Item,
      // eslint-disable-next-line no-nested-ternary
      itemId: row.corpus && row.id ? `${row.corpus}-${row.id}` : row.itemId ? row.itemId : 'practiceItem',
      itemGroup: row.itemGroup || 'core',
      target: row.target || row.Target || row.answer || row.Answer,
      distractor1: row.distractor1 || row.Distractor1,
      distractor2: row.distractor2 || row.Distractor2,
      distractor3: row.distractor3 || row.Distractor3,
      difficulty: isPractice ? row.difficulty : row.b,
      corpus_src: isPractice ? row.block : row.corpusId,
      //   Only for cva
      corpusId: row.corpus,
      decorated: row.decorated,
    };
    ['total', 'core', 'new', 'spare', 'practice', 'secondary', 'composite_comprehension'].forEach((op) => {
      ['a', 'b', 'c', 'd'].forEach((suffix) => {
        const key = `${op}.${suffix}`;
        newRow[key] = row[key];
      });
    });
    // Copy core zetas to composite_comprehension if not already set
    if (!newRow['composite_comprehension.a']) {
      ['a', 'b', 'c', 'd'].forEach((suffix) => {
        newRow[`composite_comprehension.${suffix}`] = row[`core.${suffix}`];
      });
    }
    accum.push(newRow);
    if (!isPractice) maxStimlulusTrials += 1;
    return accum;
  }, []);

export async function loadCorpus(practiceCorpus, stimulusCorpus, sequentialPractice, sequentialStimulus) {
  const currentTask = store.session.get('config').task;
  const csvAssets = {
    // storyLion: multichoiceCorpus[i18next.language].storyLion,
    storyLion: multichoiceCorpus[i18next.language].task[currentTask],
  };

  let practice;
  let stimulus;

  function downloadCSV(url, i) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          if (i === 0) {
            practice = transformCSV(results.data, true);
          } else {
            stimulus = transformCSV(results.data, false);
          }
          resolve(results.data);
        },
        error: function (error) {
          reject(error);
        },
      });
    });
  }

  async function parseMultipleCSVs(urls) {
    const promises = urls.map((url, i) => downloadCSV(url, i));
    return Promise.all(promises);
  }

  async function fetchData() {
    const urls = [
      `https://storage.googleapis.com/roar-survey/${i18next.language}/CSV/${practiceCorpus}.csv`,
      `https://storage.googleapis.com/roar-survey/${i18next.language}/CSV/${stimulusCorpus}.csv`,
    ];

    try {
      await parseMultipleCSVs(urls);
      store.session.set('maxStimulusTrials', maxStimlulusTrials);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  await fetchData();

  const transformStoryCSV = (csvInput) =>
    csvInput.reduce((accum, row) => {
      if (store.session.get('config').task === 'cva') {
        const newRow = {
          label: row.label,
          screenStyle: row.screenStyle,
          imageName1: row.imageName1,
          imageName2: row.imageName2,
          imageSpeechBubble: row.imageSpeechBubble,
          imageAlt: row.imageAlt,
          audioName: row.audioName,
          audioGap: row.audioGap,
          header1: row.header1,
          text1: row.text1,
        };
        accum.push(newRow);
        return accum;
      }
      const newRow = {
        label: row.label,
        screenStyle: row.screenStyle,
        imageName: row.imageName,
        imageAlt: row.imageAlt,
        audioName: row.audioName,
        audioGap: row.audioGap,
        header1: row.header1,
        text1: row.text1,
      };
      ['total', 'core', 'new', 'spare', 'practice', 'secondary', 'composite_comprehension'].forEach((op) => {
        ['a', 'b', 'c', 'd'].forEach((suffix) => {
          const key = `${op}.${suffix}`;
          newRow[key] = row[key];
        });
      });
      // Fallback: Copy core parameters to composite_comprehension if not already set
      // This handles older CSVs that don't have explicit composite_comprehension columns
      if (!newRow['composite_comprehension.a']) {
        ['a', 'b', 'c', 'd'].forEach((suffix) => {
          newRow[`composite_comprehension.${suffix}`] = row[`core.${suffix}`];
        });
      }
      accum.push(newRow);
      return accum;
    }, []);

  const csvTransformed = {
    practice: sequentialPractice === true ? practice : shuffle(practice),
    stimulus: sequentialStimulus === true ? stimulus : shuffle(stimulus),
    storyROARLion: transformStoryCSV(csvAssets.storyLion),
  };

  corpora = {
    practice: csvTransformed.practice,
    stimulus: csvTransformed.stimulus,
    newGroup: [],
    spareGroup: [],
    secondaryGroup: [],
    story: csvTransformed.storyROARLion,
  };

  store.session.set('corpora', corpora);

  const { numberOfTrials } = store.session.get('config');
  if (numberOfTrials > stimulus.length) {
    console.log(
      'Number of trials exceeds the number of stimuli in the corpus, reducing the number of trials to match the number of stimuli.',
    );
    store.session.set('config', {
      ...store.session.get('config'),
      numberOfTrials: corpora.stimulus.length,
    });
  }

  // Introduction & Story
  const storyAll = {
    name: 'corpusStory',
    corpusStory: csvTransformed.storyROARLion,
  };

  // future: set storyActive to the desired story
  storyActive = storyAll.corpusStory;
}
