import store from 'store2';
import _clamp from 'lodash/clamp';

export const shuffle = (array) => {
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

export const waitFor = (conditionFunction) => {
  const poll = (resolve) => {
    if (conditionFunction()) resolve();
    // eslint-disable-next-line no-unused-vars
    else setTimeout((_) => poll(resolve), 400);
  };

  return new Promise(poll);
};

// add an item to a list in the store, creating it if necessary
export const addItemToSortedStoreList = (tag, entry) => {
  if (!store.session.has(tag)) {
    console.warn(`uninitialized store tag:${tag}`);
  } else {
    // read existing list
    const sortedList = store.session(tag);

    let index = 0;
    while (index < sortedList.length && entry >= sortedList[index]) {
      // eslint-disable-next-line no-plusplus
      index++;
    }

    // Use the splice method to insert the entry at the appropriate position
    sortedList.splice(index, 0, entry);
    store.session.set(tag, sortedList);
  }
};

export function addGlowingClass(textContent, className) {
  const container = document.querySelector('#jspsych-audio-multi-response-btngroup');
  const buttons = container.querySelectorAll('div.jspsych-audio-multi-response-button');
  console.log(buttons);
  buttons.forEach((buttonDiv) => {
    const button = buttonDiv.querySelector('button');
    if (button && button.textContent.trim() === textContent) {
      console.log(button);
      button.classList.add(className);
    }
  });
}

export const getGrade = (inputGrade, gradeMin = 0, gradeMax = 12) => {
  const parsedGrade = Number(inputGrade);
  let grade;

  if (Number.isNaN(parsedGrade)) {
    // Assume grade is K, TK, or PK
    grade = gradeMin;
  } else if (parsedGrade < gradeMin) {
    grade = gradeMin;
  } else if (parsedGrade > gradeMax) {
    grade = gradeMax;
  } else {
    // grade is within range and is a number
    grade = parsedGrade;
  }

  return grade;
};

export const getPrompt = () => {
  // Split the stimulus into two parts, separated by the underlined word
  // Insert the first half of the stimulus
  // Insert the underlined word
  // Insert the second half of the stimulus
  const { promptWidth } = store.session.get('config');
  const nextStimulus = store.session.get('nextStimulus');

  // Handle case when no more items are available
  if (!nextStimulus) {
    return '<p>No more items available</p>';
  }

  if (store.session.get('config').task === 'cva') {
    const splitWord = nextStimulus.decorated;

    const regex = new RegExp(`(${splitWord}[^w])`);
    const stimulusSplitByRegex = nextStimulus.item.split(regex);
    const [beginning, middle, end] = stimulusSplitByRegex;

    return `<span class="item-stimulus-cva" style="max-width: ${promptWidth}%">
          ${beginning.trim()}
      
          <span id="decorated">
            ${middle.trim()}
          </span>
      
          ${end.trim()}   
      
          </span>`;
  }
  return `<p class="item-stimulus" style="max-width: ${promptWidth}%">${nextStimulus.item}</p>`;
};

/**
 * Clamps a positive standard error value to a valid range and guards against NaN.
 * Returns Number.MIN_VALUE if the input is NaN, zero, or negative.
 *
 * @param thetaSE - Standard error value (expected to be positive)
 * @returns Clamped value in range [Number.MIN_VALUE, Number.MAX_VALUE]
 */
export const clampPositive = (thetaSE) => {
  if (Number.isNaN(thetaSE) || thetaSE <= 0) {
    return Number.MIN_VALUE;
  }
  return _clamp(thetaSE, Number.MIN_VALUE, Number.MAX_VALUE);
};
