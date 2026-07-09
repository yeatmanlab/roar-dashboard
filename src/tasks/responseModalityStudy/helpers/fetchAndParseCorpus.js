/*
Loads csv data for the practice and experiment trials. Renames columns, shuffles trials, as required. Sets the data to a struct and exports it as "corpus".
*/
import "../../../i18n/i18n";
import Papa from "papaparse"; //parsing csv file in browser
import "regenerator-runtime/runtime"; //async function
import { dashToCamelCase } from "../../shared/helpers";
import { randomInteger } from "../../shared/helpers/randomInteger";
import store from "store2";
import { shuffle } from "../../shared/helpers";
import { prepareSurveyChoices } from "../../shared/helpers";
import { getDigit, getRandomValues } from "../../shared/helpers";

const getRandomNumbers1Digit = (n) => {
  let shuffledNumbers = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  let target = shuffledNumbers[0];
  let distractors = shuffledNumbers.slice(1, n + 1);

  return { target, distractors };
};

const getRandomNumbers2Digit = (n) => {
  let distractors = [];
  let target = Math.floor(Math.random() * 90) + 10; // Generates a number between 10 and 99
  let ones = getDigit(target, 1);
  let tens = getDigit(target, 10);
  let inc_list = [-2, -1, 1, 2];
  let inc_ones = getRandomValues(inc_list, 1)[0];
  let inc_tens = getRandomValues(inc_list, 1)[0];
  let lures_1 = target + inc_ones; //shares tens place
  let lures_2 = target + inc_tens * 10; //shares ones place

  if ((ones == 8 && inc_ones == 2) || (ones == 9 && inc_ones > -1)) {
    lures_1 = lures_1 - 5;
  } else if ((ones == 1 && inc_ones == -2) || (ones == 0 && inc_ones < 1)) {
    lures_1 = lures_1 + 5;
  }

  if ((tens == 2 && inc_tens == -2) || (tens == 1 && inc_tens < 1)) {
    lures_2 += 50;
  } else if ((tens == 8 && inc_tens == 2) || (tens == 9 && inc_tens > -1)) {
    lures_2 -= 50;
  }
  distractors.push(lures_1);
  distractors.push(lures_2);

  while (distractors.length < n) {
    let randomNum = Math.floor(Math.random() * 90) + 10; // Generates a number between 10 and 99
    if (!distractors.includes(randomNum) && randomNum != target) {
      distractors.push(randomNum);
    }
  }

  return { target, distractors };
};

const generateItemsAFC = (numItems, numDistractors, percDouble) => {
  let itemArray = [];
  for (let i = 0; i < numItems; i++) {
    let numbers;
    if (Math.random() < percDouble) {
      numbers = getRandomNumbers2Digit(numDistractors);
    } else {
      numbers = getRandomNumbers1Digit(numDistractors);
    }

    let current_item = {
      ID: i + 1,
      item: numbers.target,
      item_raw: numbers.target,
      target: numbers.target,
      distractor_list: numbers.distractors,
    };

    //randomise the order of target and distractors
    let trialInfo = prepareSurveyChoices(
      current_item["target"],
      current_item["distractor_list"],
    );
    current_item["choices"] = trialInfo.choices;
    current_item["correctResponseNum"] = trialInfo.correctResponseNum;

    itemArray.push(current_item);
  }
  return itemArray;
};

const generateItemsProduction = (numItems, percDouble) => {
  let itemArray = [];
  for (let i = 0; i < numItems; i++) {
    let number;
    if (Math.random() < percDouble) {
      number = randomInteger(10, 99);
    } else {
      number = randomInteger(0, 9);
    }
    let current_item = {
      ID: i + 1,
      target: number.toString(),
    };

    current_item["item_raw"] = current_item["target"];
    //default is production response mode
    current_item[
      "item"
    ] = `<div class="item-stimulus" id="stimulus-val"><div class="spacing-below">${current_item.item_raw}</div></div><div><input type="text" name="question_input" id="question_input_key" class="item-textbox" style="text-align:center"></div>`;
    itemArray.push(current_item);
  }
  return itemArray;
};

export const fetchAndParseCorpusRM = (task, assets) => {
  let stimulusArray = {};

  //make 200 items for each response mode: 2afc, 6afc, production
  let numItems = 200;

  stimulusArray["rtControl_2afc"] = generateItemsAFC(numItems, 1, 0);
  stimulusArray["rtControl_6afc"] = generateItemsAFC(numItems, 5, 0.9);
  stimulusArray["rtControl_production"] = generateItemsProduction(
    numItems,
    0.5,
  );

  let corpusAll = {
    stimulus: stimulusArray,
  };

  //store.session.set("corpusAll", corpusAll);
  return corpusAll;
};
