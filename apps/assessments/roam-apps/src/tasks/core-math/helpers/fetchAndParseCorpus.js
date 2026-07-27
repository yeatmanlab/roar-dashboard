import '../../../i18n/i18n';
import Papa from 'papaparse'; //parsing csv file in browser
import 'regenerator-runtime/runtime'; //async function
import katex from 'katex'; //convert latex to markup
import store from 'store2'; //storing session data
//import items from "../../../../items.csv";
//import itemsInstructions from "../../../../items-instructions.csv";
//import hyperParams from "../../../../hyperparameters_rasch_eap.csv";
//import breakMap from "../../../../break-mapping.csv"
import { prepareSurveyChoices } from '../../shared/helpers';
import { camelize, getGrade, getLanguage } from '@bdelab/roar-utils';
import { Clowder, prepareClowderCorpus } from '@bdelab/jscat';
import 'katex/dist/katex.min.css'; //katex css
import 'simple-keyboard/build/css/index.css'; //simple keyboard css
import { getCorpusNumLine } from '../../magpi/helpers';
import i18next from 'i18next';

let increment_list = [];

export let clowder;

//takes array data and converts the labels for each row to a common naming convention
const transformCSV = (csvInput) => {
  let current_ID = 1;
  let prev_ID;
  let arr = [];

  for (let i = 0; i < csvInput.length; i++) {
    const newRow = {
      itemID: parseInt(csvInput[i].ID),
      problemID: parseFloat(csvInput[i].PID),
      version: parseInt(csvInput[i].version),
      cc_grade_level: csvInput[i].cc_grade_level,
      skill: csvInput[i].skill ? csvInput[i].skill.toString().split(', ') : [],
      skill_category: csvInput[i].skill_category,
      skill_category_camel: camelize(csvInput[i].skill_category).replace(' &', ''),
      time_limit: parseInt(csvInput[i].time_limit) * 1000, //convert to milliseconds
      countdown_time: parseInt(csvInput[i].countdown_time),
      item_raw: csvInput[i].item,
      target: csvInput[i].target.toString().split(';'),
      image_height: csvInput[i].image_height,
      response_format: csvInput[i].response_format ? csvInput[i].response_format.split(';') : '',
      lead_raw: csvInput[i].lead ? csvInput[i].lead.toString().split(';') : [],
      textbox_width: csvInput[i].textbox_width,
      item_type: csvInput[i].item_type,
      audio_file: csvInput[i].audio_file ? csvInput[i].audio_file : '',
      a: parseFloat(csvInput[i].a),
      b: parseFloat(csvInput[i].b),
      b_grade: parseFloat(csvInput[i].b_grade),
      c: parseFloat(csvInput[i].c),
      d: parseFloat(csvInput[i].d),
    };
    if (i > 0) {
      prev_ID = current_ID;
      current_ID = csvInput[i].PID;

      if (prev_ID != current_ID) {
        increment_list.push(arr[i - 1].version);
      } else if (i == csvInput.length - 1) {
        increment_list.push(newRow.version);
      }
    }

    if (typeof csvInput[i].image == 'string') {
      newRow['addImage'] = csvInput[i].image.toLowerCase() === 'true';
    } else {
      newRow['addImage'] = csvInput[i].image;
    }

    // Add CAT corpus-specific columns if in CAT mode
    if (store.session.get('config').userMode === 'adaptive') {
      ['cat1', 'cat2', 'cat3', 'cat4', 'total'].forEach((op) => {
        ['a', 'b', 'c', 'd'].forEach((suffix) => {
          const key = `${op}.${suffix}`;
          newRow[key] = csvInput[i][key]; // Assign the value from csvInput
        });
      });
    }

    let distractor_list = [];

    for (let j = 1; j < 6; j++) {
      if (csvInput[i]['distractor_' + j]) {
        distractor_list.push(csvInput[i]['distractor_' + j].toString());
      } else {
        break;
      }
    }
    newRow['distractor_list'] = distractor_list;

    arr.push(newRow);
  }
  return arr;
};

const transformInstructions = (csvInput) => {
  let arr = [];
  for (let i = 0; i < csvInput.length; i++) {
    const newRow = {
      itemID: parseInt(csvInput[i].ID),
      after_item_ID: parseInt(csvInput[i].after_item_ID),
      item_raw: csvInput[i].item,
      target: csvInput[i].target ? csvInput[i].target.toString().split(';') : '',
      response_format: csvInput[i].response_format ? csvInput[i].response_format.split(';') : '',
      lead_raw: csvInput[i].lead ? csvInput[i].lead.toString().split(';') : [],
      textbox_width: csvInput[i].textbox_width,
      item_type: csvInput[i].item_type,
    };
    arr.push(newRow);
  }
  return arr;
};

const transformBreaks = (csvInput) => {
  let breakObj = [];
  const parseNumberList = (str) => str.split(',').map((s) => Number(s.trim()));

  for (let i = 0; i < csvInput.length; i++) {
    const newRow = {
      gradeLower: parseInt(csvInput[i].grade_lower),
      gradeUpper: parseInt(csvInput[i].grade_upper),
      breakIdx: parseNumberList(csvInput[i].break_idx),
      breakIdxLower: parseNumberList(csvInput[i].break_idx_lower),
      breakScreens: parseNumberList(csvInput[i].break_screens),
      startIdx: parseInt(csvInput[i].start_idx),
      lowerStartIdx: parseInt(csvInput[i].lower_start_idx),
    };
    newRow.startOffset = !!newRow.startIdx;

    breakObj.push(newRow);
  }
  return breakObj;
};

const getHyperParams = (csvInput) => {
  return {
    scale: parseFloat(csvInput[0]['transformation.scale']),
    shift: parseFloat(csvInput[0]['transformation.shift']),
    mean: parseFloat(csvInput[0]['theta.mean']),
    sd: parseFloat(csvInput[0]['theta.sd']),
    min: parseFloat(csvInput[0]['theta.min']),
    max: parseFloat(csvInput[0]['theta.max']),
    distribution: csvInput[0]['theta.distribution'],
  };
};

const parseKatex = (currentStr) => {
  let split_string = currentStr.split('<k>');
  let parsedStr = '';

  for (let i = 0; i < split_string.length; i++) {
    if (split_string[i].includes('katex')) {
      split_string[i] = split_string[i].replace('katex', '');
      parsedStr += katex.renderToString(split_string[i], {
        throwOnError: false,
      });
    } else {
      parsedStr += split_string[i];
    }
  }

  return parsedStr;
};

const addItemSpecificAudio = (stimulusArray, assets) => {
  for (let i = 0; i < stimulusArray.length; i++) {
    const audio = stimulusArray[i].audio_file;

    if (audio && audio.length !== 0) {
      assets.default.languageSpecific.shared.push(audio + '.mp3');

      // camelize the audio file name
      stimulusArray[i].audio_file = camelize(audio);
    }
  }
};

let corpusLocation;

export const fetchAndParseCorpusCoreMath = async (task, assets) => {
  let itemBank = {};
  let stimulusArray = [];
  let itemType = [];
  let subSkillRange = {};

  // get language for url
  let lng = getLanguage(i18next.language);

  //comma key
  let commaKey = ',';
  if (lng === 'pt') {
    commaKey = '.';
  }

  if (store.session.get('config').userMode === 'adaptive') {
    corpusLocation = {
      stimulus: `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/core-math/items_cat.csv`,
      instructions:
        `https://storage.googleapis.com/roam-apps/` + lng + `/shared/corpora/core-math/items-instructions.csv`,
    };
  } else {
    corpusLocation = {
      stimulus:
        `https://storage.googleapis.com/roam-apps/` +
        lng +
        `/shared/corpora/core-math/` +
        store.session.get('config').corpusName +
        `.csv`,
      instructions:
        `https://storage.googleapis.com/roam-apps/` +
        lng +
        `/shared/corpora/core-math/` +
        store.session.get('config').corpusName +
        `-instructions.csv`,
      hyperParams:
        `https://storage.googleapis.com/roam-apps/` +
        lng +
        `/shared/corpora/core-math/` +
        store.session.get('config').corpusName +
        `-hyperparams.csv`,
      breaks:
        `https://storage.googleapis.com/roam-apps/` +
        lng +
        `/shared/corpora/core-math/` +
        store.session.get('config').corpusName +
        `-break-mapping.csv`,
    };
  }

  const transformers = {
    stimulus: transformCSV,
    instructions: transformInstructions,
    hyperParams: getHyperParams,
    breaks: transformBreaks,
  };

  //call the function for transforming item list
  /*function downloadLocalCSV(data, key) {
    return new Promise((resolve, reject) => {
      if (key === 'stimulus') {
        itemBank[key] = transformCSV(data);
      } else {
        itemBank[key] = transformInstructions(data);
      }
      resolve(data);
    });
  }

  //get hyper parameter file
  function downloadHyperParamsCSV(data, key) {
    return new Promise((resolve, reject) => {
      itemBank[key] = getHyperParams(data);
      resolve(data);
    });
  }*/

  function downloadCSV(urls, key) {
    return new Promise((resolve, reject) => {
      Papa.parse(urls[key], {
        download: true,
        header: true,
        complete: function (results) {
          const transform = transformers[key];
          if (!transform) {
            throw new Error(`No transformer defined for key: ${key}`);
          }
          itemBank[key] = transform(results.data);
          resolve(results.data);
        },
        error: function (error) {
          reject(error);
        },
      });
    });
  }

  /*async function parseMultipleCSVs(urls) {
    const promises = urls.map((url, i) => downloadCSV(url, i));
    return Promise.all(promises);
  }*/

  //pass csv paths into the parsing function and set the number of trials in session data
  async function fetchData() {
    //get items array
    try {
      await downloadCSV(corpusLocation, 'stimulus');
    } catch (error) {
      console.error('Error:', error);
    }

    //get practice array
    try {
      await downloadCSV(corpusLocation, 'instructions');
    } catch (error) {
      console.error('Error:', error);
    }

    try {
      await downloadCSV(corpusLocation, 'hyperParams');
    } catch (error) {
      console.error('Error:', error);
    }

    try {
      await downloadCSV(corpusLocation, 'breaks');
    } catch (error) {
      console.error('Error:', error);
    }

    /*try {
      await downloadLocalCSV(items, "stimulus");
    } catch (error) {
      console.error("Error:", error);
    }

    try {
      await downloadLocalCSV(itemsInstructions, "instructions");
    } catch (error) {
      console.error("Error:", error);
    }*/

    /*try {
      await downloadHyperParamsCSV(hyperParams, "hyperParams");
    } catch (error) {
      console.error("Error:", error);
    }*/
  }

  await fetchData();

  let cumIdx = 0;
  let instructionCount = 0;
  let current_item;

  for (let i = 0; i < increment_list.length; i += 1) {
    //check if a instruction trial is added before this trial
    if (
      instructionCount < itemBank['instructions'].length &&
      i === itemBank['instructions'][instructionCount]['after_item_ID']
    ) {
      current_item = itemBank['instructions'][instructionCount];
      if (current_item['item_type'] === 'fractionInstruction') {
        current_item['item'] = parseKatex(current_item['item_raw']);

        current_item['lead'] = [];
        for (let j = 0; j < current_item['lead_raw'].length; j++) {
          current_item['lead'].push(
            katex.renderToString(current_item['lead_raw'][j], {
              throwOnError: false,
            }),
          );
        }

        if (current_item['lead_raw'].length > 0) {
          current_item['demoNumbers'] = current_item['lead_raw'][0].replace(/[^0-9]/g, '');
        }
      }
      current_item['assessment_stage'] = 'practice';

      stimulusArray.push(current_item);
      itemType.push(current_item['item_type']);

      instructionCount += 1;
    }

    let randomIndex = Math.floor(Math.random() * increment_list[i]);

    current_item = itemBank['stimulus'][cumIdx + randomIndex];

    current_item['item'] = parseKatex(current_item['item_raw']);

    if (current_item['addImage']) {
      assets.default.shared.push(
        'core-math_problem' + current_item['problemID'] + '_version' + current_item['version'] + '.png',
      );
    }
    if (current_item['distractor_list'].length != 0) {
      let trialInfo = prepareSurveyChoices(current_item['target'][0], current_item['distractor_list']);
      current_item['choices'] = trialInfo.choices;
      if (trialInfo.choices[0].includes('<k>')) {
        let choices_katex = [];
        for (let i = 0; i < trialInfo.choices.length; i++) {
          choices_katex.push(parseKatex(trialInfo.choices[i]));
        }
        current_item['choices_katex'] = choices_katex;
      }
      current_item['correctResponseNum'] = trialInfo.correctResponseNum;

      if (current_item['item_type'] === 'multiChoiceImage') {
        for (let i = 0; i < current_item['choices'].length; i++) {
          assets.default.shared.push(current_item['choices'][i] + '.png');
        }
      }
    }

    if (current_item['item_type'] === 'textboxResponse') {
      current_item['lead'] = [];
      for (let j = 0; j < current_item['lead_raw'].length; j++) {
        current_item['lead'].push(
          katex.renderToString(current_item['lead_raw'][j], {
            throwOnError: false,
          }),
        );
      }
    }

    if (current_item['item_type'] === 'numberLine') {
      if (current_item['item'].includes('100')) {
        current_item['limit'] = '100';
      } else {
        current_item['limit'] = '1' + commaKey + '000';
      }
    }

    current_item['countDownAppears'] = current_item['time_limit'] - current_item['countdown_time'] * 1000;

    current_item['assessment_stage'] = 'test';

    stimulusArray.push(current_item);
    itemType.push(current_item['item_type']);

    //update the min and max grades for the subskill object
    if (!Object.hasOwn(subSkillRange, current_item['skill_category_camel'])) {
      subSkillRange[current_item['skill_category_camel']] = {
        minGrade: 11,
        maxGrade: -1,
      };
    }
    if (subSkillRange[current_item['skill_category_camel']].minGrade > current_item['b_grade']) {
      subSkillRange[current_item['skill_category_camel']].minGrade = current_item['b_grade'];
    }
    if (subSkillRange[current_item['skill_category_camel']].maxGrade < current_item['b_grade']) {
      subSkillRange[current_item['skill_category_camel']].maxGrade = current_item['b_grade'];
    }
    //update index in stimulus array
    cumIdx += increment_list[i];
  }

  //For K-2 start from the beginning. If grade is not provided then it starts based on grade K condition.
  let grade = getGrade(store.session.get('config').userMetadata.grade);
  store.session.set('grade', grade);

  // grades 9-12 are all HS and correspond to the b_grade of 9 (aka HS)
  if (grade > 9 && grade < 13) {
    grade = 9;
  }
  store.session.set('cc_grade', grade);

  store.session.set('isK2', grade < 3 || grade === undefined);

  // arrays to store the previous starting point items
  let preStimulusArray = [];
  let preItemType = [];
  let checkStimulusArray = [];
  let checkItemType = [];
  let itemsToCheck = 2;
  const DEMO_CORPUS_LIMIT = 30;

  //number of items to check before dropping students to lower starting point
  store.session.set('itemsToCheck', itemsToCheck);

  const getBreaksForGrade = (breaksList, grade) => {
    if (grade === undefined) return breaksList[0];

    const match = breaksList.find((b) => b.gradeLower <= grade && grade <= b.gradeUpper);
    if (match) return match;

    const lastRow = breaksList[breaksList.length - 1];
    if (grade > lastRow.gradeUpper) return lastRow;

    return breaksList[0];
  };

  const breaks = getBreaksForGrade(itemBank.breaks, grade);

  if (breaks.startOffset) {
    const endCheck = breaks.startIdx + itemsToCheck;

    checkStimulusArray = stimulusArray.slice(breaks.startIdx, endCheck);
    checkItemType = itemType.slice(breaks.startIdx, endCheck);

    preStimulusArray = stimulusArray.slice(breaks.lowerStartIdx, breaks.startIdx);
    preItemType = itemType.slice(breaks.lowerStartIdx, breaks.startIdx);

    stimulusArray.splice(0, endCheck);
    itemType.splice(0, endCheck);
  } else if (store.session.get('config').recruitment === 'demo') {
    stimulusArray.splice(DEMO_CORPUS_LIMIT);
    itemType.splice(DEMO_CORPUS_LIMIT);
  }

  //break locations
  store.session.set('breakMap', breaks.breakIdx);
  store.session.set('maxBreaks', breaks.breakIdx.length);

  store.session.set('breakScreenNames', breaks.breakScreens);

  store.session.set('breakMappingLower', breaks.breakIdxLower);

  //add story mode assets
  let suffix = '';
  if (store.session.get('config').storyOption || store.session.get('isK2')) {
    assets.default.shared.push('core-math-end-screen-k2.png');
    suffix = '-k2';
  }

  for (let i = 0; i < breaks.breakScreens.length; i++) {
    assets.default.shared.push('core-math-break-screen-' + breaks.breakScreens[i] + '.png');
    assets.default.languageSpecific.shared.push('core-math-break-' + i + suffix + '.mp3');
  }

  //instruction assets
  assets.default.languageSpecific.shared.push('core-math-introduction' + suffix + '.mp3');
  assets.default.languageSpecific.shared.push('core-math-pretask-check' + suffix + '.mp3');
  assets.default.languageSpecific.shared.push('core-math-end-screen' + suffix + '.mp3');

  //speaker button instruction
  if (grade > 4) {
    assets.default.languageSpecific.device.push('core-math-response.gif');
  } else {
    assets.default.languageSpecific.device.push('core-math-response-k4.gif');
  }

  addItemSpecificAudio(checkStimulusArray, assets);
  addItemSpecificAudio(preStimulusArray, assets);
  addItemSpecificAudio(stimulusArray, assets);

  //set trial data to a struct, set name for later referencing
  let corpusAll = {
    stimulus: [checkStimulusArray, preStimulusArray, stimulusArray],
    itemType: [checkItemType, preItemType, itemType],
  };

  if (store.session.get('config').recruitment === 'magpiPilot') {
    //add corpus
    let corpusNL = await getCorpusNumLine();
    store.session.set('corpusNL', corpusNL);

    corpusAll['numberLine'] = corpusNL;

    //add assets
    let assetList;
    if (grade >= 3) {
      assetList = [
        'num-line-intro.mp3',
        'num-line-instr-100.mp3',
        'num-line-practice-100.mp3',
        'num-line-practice-100-correct.mp3',
        'num-line-practice-100-incorrect.mp3',
        'num-line-post-practice-100.mp3',
        'num-line-instr-1.mp3',
        'num-line-practice-1.mp3',
        'num-line-practice-1-correct.mp3',
        'num-line-practice-1-incorrect.mp3',
        'num-line-post-practice-1.mp3',
        'num-line-practice-done.mp3',
        'num-line-instr-2.mp3',
        'num-line-demo1-2.mp3',
        'num-line-demo2-2.mp3',
        'num-line-move-feedback.mp3',
      ];
    } else {
      assetList = [
        'num-line-intro-K2.mp3',
        'num-line-instr-20.mp3',
        'num-line-practice-20.mp3',
        'num-line-practice-20-correct.mp3',
        'num-line-practice-20-incorrect.mp3',
        'num-line-post-practice-20.mp3',
        'num-line-instr-100-K2.mp3',
        'num-line-practice-100-K2.mp3',
        'num-line-practice-100-correct.mp3',
        'num-line-practice-100-incorrect.mp3',
        'num-line-post-practice-100-K2.mp3',
        'num-line-practice-done.mp3',
        'num-line-move-feedback.mp3',
      ];
    }

    for (let i = 0; i < assetList.length; i++) {
      assets.default.languageSpecific.shared.push(assetList[i]);
    }
  }

  store.session.set('corpusAll', corpusAll);
  store.session.set('hyperParams', itemBank['hyperParams']);

  //add the overall min and max grade
  subSkillRange['composite'] = {
    minGrade: -1,
    maxGrade: 11,
  };
  store.session.set('subSkillRange', subSkillRange);

  if (store.session.get('config').userMode === 'adaptive') {
    initializeClowder();
  }
};

store.session.set('itemSelect', 'mfi');

export const initializeClowder = () => {
  // Define the `cats` configuration
  const catsConfig = {
    cat1: {
      method: 'MLE', // EAP
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-cat1',
    },
    cat2: {
      method: 'MLE',
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-cat2',
    },
    cat3: {
      method: 'MLE',
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-cat3',
    },
    cat4: {
      method: 'MLE',
      itemSelect: store.session.get('itemSelect'),
      minTheta: -8,
      maxTheta: 8,
      randomSeed: 'seed-cat4',
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

  const corpusClowder = store.session.get('corpusAll')['stimulus'];

  const clowderCorpus = prepareClowderCorpus(corpusClowder, ['cat1', 'cat2', 'cat3', 'cat4', 'total'], '.');

  // /* In the case of ROAM there are 2 separate stimulus files,
  //   one for practice and the other one for stimuli test, we need to add the zetas
  //   in the corresponding block -- we are not using a cat for practice */

  const corpusWithClowder = store.session.get('corpusAll');

  corpusWithClowder.stimulus = clowderCorpus;

  store.session.set('corpusAll', corpusWithClowder);

  clowder = new Clowder({
    cats: catsConfig,
    corpus: corpusWithClowder.stimulus,
    randomSeed: store.session.get('config').randomSeed ?? 'random-seed',
    // earlyStopping: earlyStoppingCats, --- use this if early stopping is needed
  });
};
