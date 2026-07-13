/*
Loads csv data for the practice and experiment trials. Renames columns, shuffles trials, as required. Sets the data to a struct and exports it as "corpus".
*/
import '../../../i18n/i18n';
import Papa from 'papaparse'; //parsing csv file in browser
import 'regenerator-runtime/runtime'; //async function
import { dashToCamelCase } from '../../shared/helpers';
import { randomInteger } from '../../shared/helpers/randomInteger';
import store from 'store2'; //storing session data
//import itemsAll from "../../../../items-all.csv";
import { shuffle } from '../../shared/helpers';
import { camelize , getLanguage } from '@bdelab/roar-utils';
//import { groupMapping } from "../../taskSetup";
import { getGrade } from '@bdelab/roar-utils';
import { Clowder, prepareClowderCorpus } from '@bdelab/jscat';
import _ from 'lodash';
import { fetchAndParseCorpusRM } from '../../responseModalityStudy/helpers';
import 'simple-keyboard/build/css/index.css';
import { isMobile } from './initStore';
import i18next from 'i18next';
import { generateItemIdx, getIdxList, assignItems, getItemFromBankFluency } from '../../shared/helpers/parseHelpers';
import {
  downloadCSVBins,
  transformItemsFluency,
  downloadCSV,
  transformOrderFluency,
  transformFluencyPractice,
} from '../../shared/helpers/downloadCSV';
import { getCorpusSymComp } from '../../magpi/helpers';

export let clowder;

export const fetchAndParseCorpusFluency = async (task, assets) => {
  let itemBank = {
    difficultyIdx: {},
    start: {},
    items: [],
  };
  let stimulusArray = [];
  stimulusArray[0] = {};
  let practiceStimulusArray = [];
  practiceStimulusArray[0] = {};
  let taskOrder = [store.session.get('config').responseMode];

  if (store.session.get('config').recruitment === 'responseModality') {
    let arfBlocks = ['production', '2afc'];
    let calfBlocks = ['production', '6afc'];
    // Shuffle order of the tasks for response modality study
    function shuffleTwo(arr) {
      if (Math.random() < 0.5) {
        return arr;
      } else {
        return arr.reverse();
      }
    }

    if (store.session.get('config')?.taskName === 'fluency-arf') {
      taskOrder = shuffleTwo([...arfBlocks]);
    } else {
      taskOrder = shuffleTwo([...calfBlocks]);
    }
  }
  store.session.set('taskOrder', taskOrder);

  //get grade to specify the keyboard practice
  let grade = getGrade(store.session.get('config').userMetadata.grade);
  store.session.set('isK2', grade < 3 || grade === undefined);
  store.session.set('grade', grade);

  // get language for url
  let lng = getLanguage(i18next.language);

  let corpusLocation;
  if (store.session.get('config').userMode === 'adaptive') {
    corpusLocation = {
      fluencyArf: {
        order: {
          block0: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/arf/items-order.csv`,
        },
        stimulus: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/arf/items-all-cat.csv`,
        practice: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/arf/items-practice-cat.csv`,
      },
      fluencyCalf: {
        order: {
          block0: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/calf/items-order-phase1.csv`,
          block1: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/calf/items-order-phase2.csv`,
          block2: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/calf/items-order-phase3.csv`,
        },
        stimulus: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/calf/items-all-cat.csv`,
        practice: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/calf/items-practice-cat.csv`,
      },
    };
  } else {
    corpusLocation = {
      fluencyArf: {
        order: {
          block0:
            `https://storage.googleapis.com/roam-apps/` +
            lng +
            `/shared/corpora/arf/` +
            store.session.get('config').corpusName +
            `-order.csv`,
        },
        stimulus:
          `https://storage.googleapis.com/roam-apps/` +
          lng +
          `/shared/corpora/arf/` +
          store.session.get('config').corpusName +
          `-all.csv`,
        practice: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/arf/items-practice.csv`,
      },
      fluencyCalf: {
        order: {
          block0:
            `https://storage.googleapis.com/roam-apps/` +
            lng +
            `/shared/corpora/calf/` +
            store.session.get('config').corpusName +
            `-order-phase1.csv`,
          block1:
            `https://storage.googleapis.com/roam-apps/` +
            lng +
            `/shared/corpora/calf/` +
            store.session.get('config').corpusName +
            `-order-phase2.csv`,
          block2:
            `https://storage.googleapis.com/roam-apps/` +
            lng +
            `/shared/corpora/calf/` +
            store.session.get('config').corpusName +
            `-order-phase3.csv`,
        },
        stimulus:
          `https://storage.googleapis.com/roam-apps/` +
          lng +
          `/shared/corpora/calf/` +
          store.session.get('config').corpusName +
          `-all.csv`,
        practice: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/calf/items-practice.csv`,
      },
    };
  }

  const urls = corpusLocation[camelize(task)];

  //pass csv paths into the parsing function and set the number of trials in session data
  async function fetchData() {
    try {
      await downloadCSVBins(urls, 'stimulus', itemBank, transformItemsFluency);
    } catch (error) {
      console.error('Error:', error);
    }

    for (var key in urls['order']) {
      try {
        await downloadCSV(urls['order'][key], key, stimulusArray[0], transformOrderFluency);
      } catch (error) {
        console.error('Error:', error);
      }
    }

    try {
      await downloadCSV(urls['practice'], 0, practiceStimulusArray, transformFluencyPractice);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  await fetchData();

  //make copies of stimulus array based on number of tasks
  for (let i = 1; i < taskOrder.length; i++) {
    stimulusArray[i] = _.cloneDeep(stimulusArray[0]);
    practiceStimulusArray[i] = _.cloneDeep(practiceStimulusArray[0]);
  }

  //for each task generate the final stimulus array and save the corpus
  let corpusAll = [];
  if (
    store.session.get('config').recruitment === 'responseModality' &&
    store.session.get('config').taskName === 'fluency-arf'
  ) {
    //generate the RT block trials
    let corpus = fetchAndParseCorpusRM();
    corpusAll.push(corpus);
  }
  if (
    store.session.get('config').recruitment === 'magpiPilot' &&
    store.session.get('config').taskName === 'fluency-arf'
  ) {
    //add corpus
    let corpus = await getCorpusSymComp();
    corpusAll.push(corpus);

    //add assets
    let assetList = [
      'sym-comp-intro.mp3',
      'sym-comp-instructions.mp3',
      'sym-comp-feedback-correct-1.mp3',
      'sym-comp-feedback-correct-2.mp3',
      'sym-comp-feedback-incorrect-1.mp3',
      'sym-comp-feedback-incorrect-2.mp3',
      'sym-comp-post-practice.mp3',
      'sym-comp-ending.mp3',
    ];
    if (grade < 2) {
      assetList = [
        'sym-comp-intro.mp3',
        'sym-comp-instructions-K.mp3',
        'sym-comp-feedback-correct-1-K.mp3',
        'sym-comp-feedback-correct-2-K.mp3',
        'sym-comp-feedback-incorrect-1-K.mp3',
        'sym-comp-feedback-incorrect-2-K.mp3',
        'sym-comp-post-practice-K.mp3',
        'sym-comp-ending.mp3',
      ];
    }

    for (let i = 0; i < assetList.length; i++) {
      assets.default.languageSpecific.shared.push(assetList[i]);
    }

    assets.default.languageSpecific.device.push('instructions-sym-magpi.gif');
  }
  for (let i = 0; i < stimulusArray.length; i++) {
    //generate the item indices
    generateItemIdx(itemBank, stimulusArray[i], getIdxList);

    //get the item values from item bank
    let finalStimulusArray = assignItems(
      Object.keys(urls['order']).length,
      stimulusArray[i],
      itemBank,
      getItemFromBankFluency,
      taskOrder[i],
    );

    //get the item values for practice items
    for (var j = 0; j < practiceStimulusArray[i].length; j++) {
      let current_item = {};
      getItemFromBankFluency(current_item, practiceStimulusArray[i][j], taskOrder[i]);
      practiceStimulusArray[i][j] = current_item;
    }

    let practiceKey = 'practice';
    if (store.session.get('config').recruitment === 'responseModality') {
      practiceKey = taskOrder[i] + '_' + practiceKey;
    }

    //set trial data to a struct, set name for later referencing (practice)
    let corpus = {
      stimulus: finalStimulusArray,
      practice: { [practiceKey]: practiceStimulusArray[i] },
    };
    corpusAll.push(corpus);
  }
  //To maintain the corpus structure when run normally as 1 task
  /*if (corpusAll.length === 1) {
    corpusAll = corpusAll[0];
  }*/

  //add assets that are response mode dependent
  let config = store.session.get('config');
  let responseMode = taskOrder[0].replace(/\d+/g, '');
  let taskName = config?.taskName;
  let labId = config?.labId;

  let assetListDevice = [
    responseMode + '-introduction-' + taskName + '-' + labId + '.mp3',
    responseMode + '-practice-intro-' + taskName + '.mp3',
    responseMode + '-practice1-' + taskName + '-incorrect.mp3',
    responseMode + '-practice2-' + taskName + '-incorrect.mp3',
    responseMode + '-post-practice-1.mp3',
    responseMode + '-game-end.mp3',
  ];
  if (taskName === 'fluency-arf' && responseMode === 'afc') {
    assetListDevice.push('instructions-fluency-2afc.mp3');
  } else if (taskName === 'fluency-calf' && responseMode === 'afc') {
    assetListDevice.push('instructions-fluency-6afc.mp3');
  }

  if (config.recruitment === 'demo') {
    assetListDevice.push(responseMode + '-post-practice-2-' + taskName + '-demo.mp3');
  } else if (config.userMode === '4andHalfMin' && config.taskName === 'fluency-calf') {
    assetListDevice.push(responseMode + '-post-practice-2-' + taskName + '-' + config.userMode + '.mp3');
  } else {
    assetListDevice.push(responseMode + '-post-practice-2-' + taskName + '.mp3');
  }
  //response modality study audio
  if (config.recruitment === 'responseModality') {
    let rtControl = shuffle(['rtControl_production', 'rtControl_2afc', 'rtControl_6afc']);
    store.session.set('blockOrderRT', rtControl);
    assetListDevice = [
      'afc-practice-intro-' + taskName + '.mp3',
      'afc-practice1-' + taskName + '-incorrect.mp3',
      'production-practice1-' + taskName + '-incorrect.mp3',
      'afc-practice2-' + taskName + '-incorrect.mp3',
      'production-practice2-' + taskName + '-incorrect.mp3',
      'afc-post-practice-1.mp3',
      'afc-post-practice-2-' + taskName + '.mp3',
      'afc-game-end.mp3',
      'responseModality-endScreen-' + taskOrder[1].replace(/\d+/g, '') + '.mp3',
    ];
    if (rtControl[0] === 'rtControl_production') {
      assetListDevice.push('responseModality-practice-production1.mp3');
      assetListDevice.push('responseModality-practice-afc2.mp3');
      if (rtControl[2].includes('2afc')) {
        assetListDevice.push('responseModality-practice-2afc.mp3');
      } else {
        assetListDevice.push('responseModality-practice-6afc.mp3');
      }
    } else {
      assetListDevice.push('responseModality-practice-afc1.mp3');
      assetListDevice.push('responseModality-practice-production2.mp3');
      if (rtControl[0].includes('2afc')) {
        assetListDevice.push('responseModality-practice-6afc.mp3');
      } else {
        assetListDevice.push('responseModality-practice-2afc.mp3');
      }
    }

    if (isMobile) {
      assetListDevice.push('production-post-practice-1.mp3');
    } else {
      assetListDevice.push('production-post-practice-1-arrow.mp3');
    }
    if (store.session.get('config').taskName === 'fluency-arf') {
      if (rtControl[0].includes('production')) {
        assetListDevice.push('responseModality-introduction-fluency-arf-production.mp3');
      } else if (rtControl[0].includes('2afc')) {
        assetListDevice.push('responseModality-introduction-fluency-arf-2afc.mp3');
      } else {
        assetListDevice.push('responseModality-introduction-fluency-arf-6afc.mp3');
      }
      assetListDevice.push('response-time-2afc.gif');
      assetListDevice.push('response-time-6afc.gif');
      assetListDevice.push('keyboard-example-5.gif');
      assetListDevice.push('responseModality-postControl-' + taskOrder[0].replace(/\d+/g, '') + '.mp3');
      assetListDevice.push('instructions-fluency-keyboard.mp3');
      assetListDevice.push('instructions-fluency-2afc.mp3');
    } else {
      assetListDevice.push('responseModality-introduction-fluency-calf-' + taskOrder[0].replace(/\d+/g, '') + '.mp3');
      assetListDevice.push('instructions-fluency-6afc.mp3');
      assetListDevice.push('afc-post-practice-2-fluency-calf-4andHalfMin.mp3');
    }
  }
  /*if ((config.recruitment === "prolific") & (config.labId === "YeatmanLab")) {
    let endAudio =
      groupMapping[config?.group][config?.taskName][config?.responseMode]
        .endAudio;
    assetListShared = [
      "responseModalityStudy-introduction-" +
        config?.taskName +
        "-" +
        responseMode +
        ".mp3",
      responseMode + "-practice-intro-" + taskName + ".mp3",
      responseMode + "-practice1-" + taskName + "-correct.mp3",
      responseMode + "-practice1-" + taskName + "-incorrect.mp3",
      responseMode + "-practice2-" + taskName + "-correct.mp3",
      responseMode + "-practice2-" + taskName + "-incorrect.mp3",
      "responseModalityStudy-post-practice-1-" + responseMode + ".mp3",
      "responseModalityStudy-post-practice-2-" +
        taskName +
        "-" +
        responseMode +
        ".mp3",
      endAudio + ".mp3",
    ];

    if (config.keyboardPractice) {
      assetListShared.push("instructions-fluency-practice.mp3");
    } else {
      assetListShared.push("instructions-fluency-no-practice.mp3");
    }
  }*/

  for (var i = 0; i < assetListDevice.length; i++) {
    assets.default.languageSpecific.device.push(assetListDevice[i]);
  }

  store.session.set('corpusAll', corpusAll);
  if (store.session.get('config').userMode === 'adaptive') {
    initializeClowder();
  }
};

store.session.set('itemSelect', 'mfi');

export const initializeClowder = () => {
  // Define the `cats` configuration
  const catsConfig = {
    sum: {
      method: 'MLE', // EAP
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-sum',
    },
    minus: {
      method: 'MLE',
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-minus',
    },
    mult: {
      method: 'MLE',
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-mult',
    },
    div: {
      method: 'MLE',
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-div',
    },
    total: {
      method: 'MLE',
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-total',
    },
  };

  // USE THIS EXAMPLE TO GET EARLY STOPPING CATS -- REMEMBER TO IMPORT FUNCTIONS FROM CLOWDER AS NEEDED

  // if (store.session.get('config').earlyStopping) {
  // earlyStoppingCats = new StopAfterNItems({
  //   requiredItems: {
  //     sum:  5,
  //     minus: 5,
  //     div: 15,
  //     mult: 15,
  //   },
  //   logicalOperation: 'only',
  // });

  const corpusClowder = store.session.get('corpusAll')['stimulus']['block0'];

  const clowderCorpus = prepareClowderCorpus(corpusClowder, ['sum', 'minus', 'mult', 'div', 'total'], '.');

  /* In the case of ROAM there are 2 separate stimulus files, 
    one for practice and the other one for stimuli test, we need to add the zetas
    in the corresponding block -- we are not using a cat for practice */

  const corpusWithClowder = store.session.get('corpusAll');

  corpusWithClowder.stimulus.block0 = clowderCorpus;

  store.session.set('corpusAll', corpusWithClowder);

  clowder = new Clowder({
    cats: catsConfig,
    corpus: corpusWithClowder.stimulus.block0,
    randomSeed: store.session.get('config').randomSeed ?? 'random-seed',
    // earlyStopping: earlyStoppingCats, --- use this if early stopping is needed
  });
};
