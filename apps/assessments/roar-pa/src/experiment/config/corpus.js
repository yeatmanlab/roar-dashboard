import i18next from 'i18next';
import store from 'store2';
import _shuffle from 'lodash/shuffle';
import { PA_TRIAL_TYPES, PA_CATS, PA_CORPUS_TYPES } from '@roar-dashboard/assessment-schema/pa';
import { corpusTranslations } from '../i18n';
import { standardizeItemComponent } from '../experimentHelpers';

export function processCSV(config = {}) {
  const { isAdaptive, numTestItems } = config;
  const csvAssets = {
    test: isAdaptive
      ? corpusTranslations[i18next.language].testCatFoundational
      : corpusTranslations[i18next.language].test,
    practice: isAdaptive
      ? corpusTranslations[i18next.language].practiceCat
      : corpusTranslations[i18next.language].practice,
  };

  const transformCSV = (csvInput) => {
    const csv = csvAssets[csvInput];

    return csv.reduce((accum, row) => {
      const newRow = {
        task: row.task,
        trial_type: row.trial_type,
        itemId: csvInput === 'practice' ? row.trial_num : row.original_name,
        stimulus: standardizeItemComponent(row.stim),
        goal: standardizeItemComponent(row.goal),
        foil1: standardizeItemComponent(row.foil1),
        foil2: standardizeItemComponent(row.foil2),
        arrayShow: _shuffle([
          standardizeItemComponent(row.goal),
          standardizeItemComponent(row.foil1),
          standardizeItemComponent(row.foil2),
        ]),
        quest: standardizeItemComponent(row.quest),
        instr: row.instr ? standardizeItemComponent(row.instr) : null,
        feedback_conf: row.feedback_conf ? standardizeItemComponent(row.feedback_conf) : null,
        feedback_foil1: row.feedback_foil1 ? standardizeItemComponent(row.feedback_foil1) : null,
        feedback_foil2: row.feedback_foil2 ? standardizeItemComponent(row.feedback_foil2) : null,
      };
      if (isAdaptive) {
        PA_CATS.forEach((op) => {
          ['a', 'b', 'c', 'd'].forEach((suffix) => {
            const key = `${op}.${suffix}`;
            newRow[key] = row[key]; // Assign the value from csvInput
          });
        });
      }
      accum.push(newRow);
      return accum;
    }, []);
  };

  function countTrialTypes(document) {
    // Initialize counts for each trial type
    let fsmCount = 0;
    let lsmCount = 0;
    let delCount = 0;

    // Iterate through each row in the document
    document.forEach((row) => {
      // Check the trial type of the row
      switch (row.trial_type) {
        case PA_TRIAL_TYPES.FSM:
          fsmCount += 1;
          break;
        case PA_TRIAL_TYPES.LSM:
          lsmCount += 1;
          break;
        case PA_TRIAL_TYPES.DEL:
          delCount += 1;
          break;
        default:
          // Handle other trial types if needed
          break;
      }
    });

    // Return an object containing the counts for each trial type
    return {
      [PA_TRIAL_TYPES.FSM]: fsmCount,
      [PA_TRIAL_TYPES.LSM]: lsmCount,
      [PA_TRIAL_TYPES.DEL]: delCount,
    };
  }

  const test = countTrialTypes(csvAssets.test);
  const practice = countTrialTypes(csvAssets.practice);

  let numItems;
  // If the experiment is adaptive or the number of test items is not specified, use the full corpus
  if (isAdaptive || !numTestItems) {
    numItems = {
      numItemsFSM: test[PA_TRIAL_TYPES.FSM],
      numItemsLSM: test[PA_TRIAL_TYPES.LSM],
      numItemsDEL: test[PA_TRIAL_TYPES.DEL],
    };
  } else {
    numItems = {
      numItemsFSM: numTestItems,
      numItemsLSM: numTestItems,
      numItemsDEL: test[PA_TRIAL_TYPES.DEL] > 0 ? numTestItems : 0,
    };
  }

  store.session.set('numItems', numItems);

  const corpus = {
    test_FSM: transformCSV(PA_CORPUS_TYPES.TEST).slice(0, test[PA_TRIAL_TYPES.FSM]),
    test_LSM: transformCSV(PA_CORPUS_TYPES.TEST).slice(test[PA_TRIAL_TYPES.FSM], test[PA_TRIAL_TYPES.FSM] + test[PA_TRIAL_TYPES.LSM]),
    test_DEL: transformCSV(PA_CORPUS_TYPES.TEST).slice(
      test[PA_TRIAL_TYPES.FSM] + test[PA_TRIAL_TYPES.LSM],
      test[PA_TRIAL_TYPES.FSM] + test[PA_TRIAL_TYPES.LSM] + test[PA_TRIAL_TYPES.DEL],
    ),
    practice_FSM: transformCSV(PA_CORPUS_TYPES.PRACTICE).slice(0, practice[PA_TRIAL_TYPES.FSM]),
    practice_LSM: transformCSV(PA_CORPUS_TYPES.PRACTICE).slice(
      practice[PA_TRIAL_TYPES.FSM],
      practice[PA_TRIAL_TYPES.FSM] + practice[PA_TRIAL_TYPES.LSM],
    ),
    practice_DEL: transformCSV(PA_CORPUS_TYPES.PRACTICE).slice(
      practice[PA_TRIAL_TYPES.FSM] + practice[PA_TRIAL_TYPES.LSM],
      practice[PA_TRIAL_TYPES.FSM] + practice[PA_TRIAL_TYPES.LSM] + practice[PA_TRIAL_TYPES.DEL],
    ),
  };

  if (i18next.language === 'es') {
    corpus.test_FSM = _shuffle(corpus.test_FSM);
    corpus.test_LSM = _shuffle(corpus.test_LSM);
    corpus.test_DEL = _shuffle(corpus.test_DEL);
  }

  store.session.set('corpus', corpus);
}
