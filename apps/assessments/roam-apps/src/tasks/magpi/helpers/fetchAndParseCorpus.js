import 'regenerator-runtime/runtime'; //async function
import store from 'store2';
import { getGrade } from '@bdelab/roar-utils';
//import itemsAll from "../../../../items-symComp-all.csv"
//import itemsOrder from "../../../../items-symComp-order.csv"
//import itemsAll from "../../../../items-numberLine-all.csv"
import katex from 'katex'; //convert latex to markup
import 'katex/dist/katex.min.css'; //katex css
//import { version } from "process";
import {
  generateItemIdx,
  getIdxList,
  getIdxListByVersion,
  assignItems,
  getItemFromBank,
  getItemFromBankKatex,
} from '../../shared/helpers/parseHelpers';
import {
  downloadCSVBins,
  downloadCSV,
  transformItemsSymComp,
  transformItemsNumLine,
  transformOrderMagpi,
} from '../../shared/helpers/downloadCSV';

export const getCorpusSymComp = async () => {
  let itemBank = {
    difficultyIdx: {},
    start: {},
    items: [],
  };
  let stimulusArray = [];

  let practiceItems = [12, 34];

  let corpusLocation = {
    symbolic: {
      order: {
        block0: `https://storage.googleapis.com/roam-apps/shared/corpora/magpi/items-symComp-order.csv`,
      },
      stimulus: `https://storage.googleapis.com/roam-apps/shared/corpora/magpi/items-symComp-all.csv`,
    },
  };

  const symCompOrder = corpusLocation.symbolic.order;

  //pass csv paths into the parsing function and set the number of trials in session data
  async function fetchData() {
    //get items array
    try {
      await downloadCSVBins(corpusLocation['symbolic'], 'stimulus', itemBank, transformItemsSymComp);
    } catch (error) {
      console.error('Error:', error);
    }

    //for (var key in urls["order"]) {
    try {
      await downloadCSV(symCompOrder['block0'], 'block0', stimulusArray, transformOrderMagpi);
    } catch (error) {
      console.error('Error:', error);
    }
    //}
  }

  await fetchData();

  let practiceArray = {
    practice: [],
  };
  for (let i = 0; i < practiceItems.length; i++) {
    let current_item = itemBank.items[practiceItems[i]];
    //swap the order
    current_item.choices = [current_item.number_r, current_item.number_l];
    current_item.correctResponseNum = 1 - current_item.correctResponseNum;
    current_item.number_l = current_item.choices[0];
    current_item.number_r = current_item.choices[1];
    current_item.bin_description = '';
    current_item.difficulty = '';
    current_item.itemID = i + 1;
    practiceArray['practice'].push(current_item);
  }

  generateItemIdx(itemBank, stimulusArray, getIdxList);

  //get the item values from item bank
  let finalStimulusArray = assignItems(1, stimulusArray, itemBank, getItemFromBank);

  //set trial data to a struct, set name for later referencing
  let corpusAll = {
    stimulus: finalStimulusArray,
    practice: practiceArray,
  };

  return corpusAll;
};

export const getCorpusNumLine = async () => {
  let itemBank = {
    difficultyIdx: {},
    verInc: {},
    start: {},
    items: [],
  };
  let stimulusArray = {};

  let corpusLocation = {
    numberLine: {
      orderK2: {
        block0: `https://storage.googleapis.com/roam-apps/shared/corpora/magpi/items-numberLine-order-0-20.csv`,
        block1: `https://storage.googleapis.com/roam-apps/shared/corpora/magpi/items-numberLine-order-0-100.csv`,
      },
      order: {
        block0: `https://storage.googleapis.com/roam-apps/shared/corpora/magpi/items-numberLine-order-0-100.csv`,
        block1: `https://storage.googleapis.com/roam-apps/shared/corpora/magpi/items-numberLine-order-0-1.csv`,
        block2: `https://storage.googleapis.com/roam-apps/shared/corpora/magpi/items-numberLine-order-0-2.csv`,
      },
      stimulus: `https://storage.googleapis.com/roam-apps/shared/corpora/magpi/items-numberLine-all.csv`,
    },
  };

  let grade = getGrade(store.session.get('config').userMetadata.grade);
  store.session.set('grade', grade);

  let numberLineOrder = corpusLocation.numberLine.order;

  // default is K2 version
  if (grade < 3 || grade === undefined) {
    store.session.set('isK2', true);
    numberLineOrder = corpusLocation.numberLine.orderK2;
  }

  //pass csv paths into the parsing function and set the number of trials in session data
  async function fetchData() {
    try {
      await downloadCSVBins(corpusLocation.numberLine, 'stimulus', itemBank, transformItemsNumLine);
    } catch (error) {
      console.error('Error:', error);
    }

    for (var key in numberLineOrder) {
      try {
        await downloadCSV(numberLineOrder[key], key, stimulusArray, transformOrderMagpi);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  }

  await fetchData();

  //generate the item indices
  generateItemIdx(itemBank, stimulusArray, getIdxListByVersion);

  //get the item values from item bank
  let finalStimulusArray = assignItems(
    Object.keys(numberLineOrder).length,
    stimulusArray,
    itemBank,
    getItemFromBankKatex,
  );

  //set trial data to a struct, set name for later referencing
  let corpusAll = {
    stimulus: finalStimulusArray,
    practice: [],
  };
  let exampleFrac = katex.renderToString('\\frac{1}{2}', {
    throwOnError: false,
  });
  store.session.set('exampleFrac', exampleFrac);
  let demoFrac = katex.renderToString('1\\frac{1}{2}', {
    throwOnError: false,
  });
  store.session.set('demoFrac', demoFrac);

  return corpusAll;
};

export const fetchAndParseCorpusMagpi = async (task, assets) => {
  let corpusNL = await getCorpusNumLine();
  let corpusSC = await getCorpusSymComp();

  let corpusAll = {
    numberLine: corpusNL,
    symbolicComp: corpusSC,
  };

  store.session.set('corpusAll', corpusAll);
};
