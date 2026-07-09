import "katex/dist/katex.min.css"; //katex css
import katex from "katex"; //convert latex to markup
import {
  lures_calf_addition,
  lures_calf_subtraction,
  lures_calf_multiplication,
  lures_calf_division,
} from "../../fluency/helpers";
import { randomInteger } from ".";
import { prepareSurveyChoices } from ".";
import store from "store2";

//Get item properties from the item bank
export const getItemFromBank = (current_item, item, _responseMode) => {
  for (const property in item) {
    current_item[property] = item[property];
  }
};

export const getItemFromBankKatex = (current_item, item, _responseMode) => {
  getItemFromBank(current_item, item);

  //use katex for generating fraction html
  if (current_item["item"].includes("frac")) {
    current_item["itemKatex"] = katex.renderToString(current_item["item"], {
      throwOnError: false,
    });
  } else {
    current_item["itemKatex"] = current_item["item"];
  }
};

// fluency specific as it incorporates response mode and distractors
export const getItemFromBankFluency = (current_item, item, responseMode) => {
  //default is production response mode
  for (const property in item) {
    if (!property.includes("distractor")) {
      current_item[property] = item[property];
    }
  }
  let distractor_list = [];
  //select distractor if 2afc
  if (responseMode === "2afc") {
    //if 2afc then assumed to be arf which has 4 possible distractors
    let dist_id = randomInteger(1, item["distractor_list"].length);
    current_item["distractor"] = item["distractor_list"][dist_id - 1];
    current_item["distractorID"] = dist_id;
    distractor_list.push(current_item["distractor"]);
  }

  //generate all distractors if 6afc
  if (responseMode === "6afc") {
    if (current_item["operator"] == "+") {
      distractor_list = lures_calf_addition(
        current_item["operand1"],
        current_item["operand2"],
        current_item["difficulty"],
      );
    } else if (current_item["operator"] == "-") {
      distractor_list = lures_calf_subtraction(
        current_item["operand1"],
        current_item["operand2"],
        current_item["difficulty"],
      );
    } else if (current_item["operator"] == "&times") {
      distractor_list = lures_calf_multiplication(
        current_item["operand1"],
        current_item["operand2"],
      );
    } else {
      distractor_list = lures_calf_division(
        current_item["operand1"],
        current_item["operand2"],
      );
    }
  }

  if (distractor_list.length !== 0) {
    //randomise the order of target and distractors
    let trialInfo = prepareSurveyChoices(
      current_item["target"],
      distractor_list,
    );
    current_item["choices"] = trialInfo.choices;
    current_item["correctResponseNum"] = trialInfo.correctResponseNum;
    current_item["distractor_list"] = distractor_list;
  }

  current_item["item_raw"] =
    current_item.operand1 +
    " " +
    current_item.operator +
    " " +
    current_item.operand2 +
    " =";
};

//Assign the final stimulus array based on the generated indices
export const assignItems = (
  numBlocks,
  stimulusArray,
  itemBank,
  applyItemFn,
  responseMode,
) => {
  let finalStimulusArray = {};
  for (let i = 0; i < numBlocks; i++) {
    let key = "block" + i;
    for (var j = 0; j < stimulusArray[key]["arr"].length; j++) {
      let difficulty = stimulusArray[key]["arr"][j]["difficulty"];
      let itemRandIdx = stimulusArray[key]["idxList"][difficulty].pop();
      let current_item = stimulusArray[key]["arr"][j];
      applyItemFn(current_item, itemBank["items"][itemRandIdx], responseMode);
    }
    let finalKey = key;
    if (store.session.get("config").recruitment === "responseModality") {
      //modify the final key to include the response mode for response modality study
      finalKey = responseMode + "_" + key;
    }
    finalStimulusArray[finalKey] = stimulusArray[key]["arr"];
  }
  return finalStimulusArray;
};

//Returns a random sample of indices for a given item bin
export const getRandomFromBucket = (bucket, n) => {
  let rand_idx_list = [];
  for (let i = 0; i < n; i++) {
    var randomIndex = Math.floor(Math.random() * bucket.length);
    rand_idx_list.push(bucket.splice(randomIndex, 1)[0]);
  }
  return rand_idx_list;
};

export const getIdxList = (itemBank, difficultyKey) => {
  return itemBank.difficultyIdx[difficultyKey].slice();
};

export const getIdxListByVersion = (itemBank, difficultyKey) => {
  const idx_list = [];
  const increment_list = itemBank.verInc[difficultyKey];

  let cumIdx = 0;

  for (let i = 0; i < increment_list.length; i++) {
    if (increment_list[i] > 1) {
      const randomIndex = Math.floor(Math.random() * increment_list[i]);
      idx_list.push(
        itemBank.difficultyIdx[difficultyKey][cumIdx + randomIndex],
      );
    } else {
      idx_list.push(itemBank.difficultyIdx[difficultyKey][cumIdx]);
    }

    cumIdx += increment_list[i];
  }

  return idx_list;
};

export const generateItemIdx = (itemBank, stimulusArray, buildIdxListFn) => {
  for (const difficultyKey in itemBank.difficultyIdx) {
    const idx_list = buildIdxListFn(itemBank, difficultyKey);

    for (const stimKey in stimulusArray) {
      if (!stimulusArray[stimKey].idxList) {
        stimulusArray[stimKey].idxList = {};
      }

      if (stimulusArray[stimKey].difficultyCount[difficultyKey]) {
        stimulusArray[stimKey].idxList[difficultyKey] = getRandomFromBucket(
          idx_list,
          stimulusArray[stimKey].difficultyCount[difficultyKey],
        ).map((idx) => idx + itemBank.start[difficultyKey]);
      }
    }
  }
};
