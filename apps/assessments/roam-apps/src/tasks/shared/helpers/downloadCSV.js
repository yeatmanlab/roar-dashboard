import Papa from 'papaparse'; //parsing csv file in browser
import store from 'store2';

//call the function for transforming item list
export function downloadLocalCSV(data, itemBank) {
  return new Promise((resolve, reject) => {
    itemBank['items'] = transformItemsCSV(data, itemBank['difficultyIdx'], itemBank['start']);
    resolve(data);
  });
}

export function downloadCSVBins(urls, key, itemBank, transformFn) {
  return new Promise((resolve, reject) => {
    Papa.parse(urls[key], {
      download: true,
      header: true,
      complete: function (results) {
        itemBank['items'] = transformFn(results.data, itemBank['difficultyIdx'], itemBank['start'], itemBank['verInc']);
        resolve(results.data);
      },
      error: function (error) {
        reject(error);
      },
    });
  });
}

export function downloadLocalCSVOrder(data, key, stimulusArray) {
  return new Promise((resolve, reject) => {
    stimulusArray[key] = transformOrderCSV(data);
    resolve(data);
  });
}

export function downloadCSV(url, key, stimulusArray, transformFn) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      complete: function (results) {
        stimulusArray[key] = transformFn(results.data);
        resolve(results.data);
      },
      error: function (error) {
        reject(error);
      },
    });
  });
}

/*function downloadLocalCSVPractice(data) {
    return new Promise((resolve, reject) => {
      practiceStimulusArray[0] = transformCSV(data);
      resolve(data);
    });
  }*/

//for transforming the csv when it is a local file
/*function downloadLocalCSV(data, i) {
    return new Promise((resolve, reject) => {
      stimulusArray.push(transformCSV(data));
      resolve(data);
    });
  }

  //call the function for transforming item list
  function downloadLocalCSV(data) {
    return new Promise((resolve, reject) => {
      itemBank["items"] = transformItemsCSV(
        data,
        itemBank["difficultyIdx"],
        itemBank["start"],
      );
      resolve(data);
    });
  }

  //call the function for transforming order list
  function downloadLocalCSVOrder(data) {
    return new Promise((resolve, reject) => {
      stimulusArray.push(transformOrderCSV(data));
      resolve(data);
    });
  }*/

/* Functions for pulling out the items from csv format */

//extract item order
const transformOrder = (csvInput, rowTransformFn) => {
  let arr = [];
  let difficultyCount = {};
  for (var i = 0; i < csvInput.length; i++) {
    const newRow = rowTransformFn(csvInput[i]);
    arr.push(newRow);
    //count the number of occurances of each difficulty bin
    if (newRow.difficulty in difficultyCount) {
      difficultyCount[newRow.difficulty]++;
    } else {
      difficultyCount[newRow.difficulty] = 1;
    }
  }
  return {
    arr: arr,
    difficultyCount: difficultyCount,
  };
};

export const transformOrderMagpi = (csvInput) =>
  transformOrder(csvInput, (row) => ({
    orderID: row.ID,
    difficulty: row.difficulty,
  }));

export const transformOrderFluency = (csvInput) =>
  transformOrder(csvInput, (row) => ({
    orderID: row.ID,
    vectorID: row.Vector,
    positionID: row.PID,
    difficulty: row.difficulty,
  }));

//extract fluency items
export const transformItemsFluency = (csvInput, difficultyIdx, start) => {
  const difficultyTracker = createBinTracker(difficultyIdx, start);

  // Helper function to extract distractor list
  const getDistractorList = (row) => {
    return Array.from({ length: 5 }, (_, j) => row[`distractor_${j + 1}`]).filter(Boolean);
  };

  // Transform CSV input
  const newRows = csvInput.map((row, i) => {
    const { ID, number_a, number_b, operator, difficulty, target, Target, answer, Answer, skill } = row;

    const newRow = {
      itemID: ID,
      operand1: parseInt(number_a),
      operand2: parseInt(number_b),
      operator,
      target: target || Target || answer || Answer,
      difficulty,
      skill: skill ? skill.toString() : '',
    };

    newRow.skill = newRow.skill ? newRow.skill.split(', ') : [];

    // Extract distractor list
    newRow.distractor_list = getDistractorList(row);

    // Add CAT corpus-specific columns if in CAT mode
    if (store.session.get('config').userMode === 'adaptive') {
      ['sum', 'minus', 'mult', 'div', 'total'].forEach((op) => {
        ['a', 'b', 'c', 'd'].forEach((suffix) => {
          newRow[`${op}.${suffix}`] = row[`${op}.${suffix}`];
        });
      });
    }
    difficultyTracker.process(difficulty, i);

    return newRow;
  });

  difficultyTracker.finalize();

  return newRows;
};

//takes array data and converts the labels for each row to a common naming convention
export const transformFluencyPractice = (csvInput) => {
  let arr = [];
  for (var i = 0; i < csvInput.length; i++) {
    const newRow = {
      itemID: csvInput[i].ID,
      operand1: parseInt(csvInput[i].number_a),
      operand2: parseInt(csvInput[i].number_b),
      operator: csvInput[i].operator,
      target: csvInput[i].target || csvInput[i].Target || csvInput[i].answer || csvInput[i].Answer,
      difficulty: csvInput[i].difficulty,
      audio: csvInput[i].audio,
    };

    //get the distractor list
    let distractor_list = [];
    for (var j = 1; j < 6; j++) {
      if (csvInput[i]['distractor_' + j]) {
        distractor_list.push(csvInput[i]['distractor_' + j]);
      }
    }
    newRow['distractor_list'] = distractor_list;

    //convert latex string to markup
    //newRow["item"] = katex.renderToString(newRow.item_raw, {
    //throwOnError: false,
    //});
    arr.push(newRow);
  }
  return arr;
};

//extract number line items
export const transformItemsNumLine = (csvInput, difficultyIdx, start, verInc) => {
  const difficultyTracker = createBinTracker(difficultyIdx, start);
  const versionTracker = createVersionTracker(verInc);

  // Transform CSV input
  const newRows = csvInput.map((row, i) => {
    const { ID, block, difficulty, problem_ID, version, lower, upper, item, target, slider_step } = row;

    const newRow = {
      itemID: ID,
      block: block,
      difficulty: difficulty,
      problem_ID: parseInt(problem_ID),
      version: parseInt(version),
      lower: parseInt(lower),
      upper: parseInt(upper),
      item: String(item),
      target: parseFloat(target),
      slider_step: parseFloat(slider_step),
    };

    difficultyTracker.process(newRow.difficulty, i);
    //keep track of number of versions
    versionTracker.process(newRow.difficulty, newRow.problem_ID, newRow.version);

    return newRow;
  });

  difficultyTracker.finalize();
  versionTracker.finalize();

  return newRows;
};

//extract symbolic number comparison items
export const transformItemsSymComp = (csvInput, difficultyIdx, start) => {
  const difficultyTracker = createBinTracker(difficultyIdx, start);

  // Transform CSV input
  const newRows = csvInput.map((row, i) => {
    const { ID, number_l, number_r, target, target_pos, difficulty, bin_description, distance } = row;

    const newRow = {
      itemID: parseInt(ID),
      number_l: parseInt(number_l),
      number_r: parseInt(number_r),
      target: parseInt(target),
      correctResponseNum: parseInt(target_pos),
      difficulty,
      bin_description,
      distance: parseInt(distance),
    };

    newRow.choices = [number_l, number_r];
    newRow.distractor_list = newRow.choices[1 - target_pos];

    // Track difficulty bins
    difficultyTracker.process(difficulty, i);

    return newRow;
  });

  difficultyTracker.finalize();

  return newRows;
};

/* helpers for transforming items */

// Track item difficulties
export const createBinTracker = (difficultyIdx, start) => {
  let prevDifficulty = null;
  let counter = 0;

  return {
    process(difficulty, i) {
      if (prevDifficulty === null || difficulty !== prevDifficulty) {
        if (prevDifficulty !== null) {
          difficultyIdx[prevDifficulty] = Array.from({ length: counter }, (_, idx) => idx);
        }

        start[difficulty] = i;
        counter = 0;
      }

      prevDifficulty = difficulty;
      counter++;
    },

    finalize() {
      if (prevDifficulty !== null) {
        difficultyIdx[prevDifficulty] = Array.from({ length: counter }, (_, idx) => idx);
      }
    },
  };
};

// Track item versions
export const createVersionTracker = (output) => {
  let prevId = null;
  let prevDifficulty = null;
  let prevVersion = null;

  return {
    process(difficulty, id, version) {
      if (prevId !== null && (id !== prevId || difficulty !== prevDifficulty)) {
        if (!output[prevDifficulty]) output[prevDifficulty] = [];
        output[prevDifficulty].push(prevVersion);
      }

      prevId = id;
      prevDifficulty = difficulty;
      prevVersion = version;
    },

    finalize() {
      if (prevDifficulty !== null) {
        if (!output[prevDifficulty]) output[prevDifficulty] = [];
        output[prevDifficulty].push(prevVersion);
      }
    },
  };
};
