import _chunk from 'lodash/chunk';

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

const randomAssignGroup = (objects, numGroups, itemsPerGroup) => {
  // Initialize groups

  const groups = _chunk(objects, itemsPerGroup);

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < numGroups; i++) {
    // eslint-disable-next-line no-shadow
    const numbers = shuffle(Array.from({ length: itemsPerGroup }, (_, i) => i + 1));
    // eslint-disable-next-line no-plusplus
    for (let j = 0; j < itemsPerGroup; j++) {
      groups[i][j].group = numbers[j];
    }
  }

  return groups;
};
export const splitList = (objects, numGroups, itemsPerGroup, presentationTimeList) => {
  const corpus = shuffle(objects).slice(0, itemsPerGroup * numGroups);
  // Sort the objects based on 'difficulty' values in ascending order
  corpus.sort((a, b) => a.difficulty - b.difficulty);

  // Initialize groups
  const groups = randomAssignGroup(corpus, itemsPerGroup, numGroups);
  const groupsUpdated = new Array(numGroups).fill().map(() => []);
  for (let i = 0; i < numGroups; i += 1) {
    for (let j = 0; j < itemsPerGroup; j += 1) {
      const { group } = groups[j][i];
      groupsUpdated[group - 1].push(groups[j][i]);
    }
  }

  for (let i = 0; i < numGroups; i += 1) {
    for (let j = 0; j < itemsPerGroup; j += 1) {
      groupsUpdated[i][j].presentationTime = presentationTimeList[i];
    }
  }

  return groupsUpdated;
};

export const splitList2 = (objects, numGroups, itemsPerGroup, presentationTimeList) => {
  const corpus = shuffle(objects).slice(0, itemsPerGroup * numGroups);

  // Initialize groups
  const groups = randomAssignGroup(corpus, itemsPerGroup, numGroups);
  const groupsUpdated = new Array(numGroups).fill().map(() => []);
  for (let i = 0; i < numGroups; i += 1) {
    for (let j = 0; j < itemsPerGroup; j += 1) {
      const { group } = groups[j][i];
      groupsUpdated[group - 1].push(groups[j][i]);
    }
  }

  for (let i = 0; i < numGroups; i += 1) {
    for (let j = 0; j < itemsPerGroup; j += 1) {
      groupsUpdated[i][j].presentationTime = presentationTimeList[i];
    }
  }

  return groupsUpdated;
};

export const shuffleBlocks = (values2repeat, n) => {
  const list = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < n; i++) {
    list.push(...shuffle(values2repeat));
  }
  return list;
};

export const combineLists = (list1, list2) => {
  if (list1.length !== list2.length) {
    throw new Error('Lists must have the same length');
  }

  const combinedList = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < list1.length; i++) {
    combinedList.push([...list1[i], ...list2[i]]);
  }

  return combinedList;
};

export const createBlocks = (numTrialsTotal, numBlocks) => {
  // Calculate the size of each block
  const blockSize = Math.ceil(numTrialsTotal / numBlocks);

  // Initialize an array to store the blocks
  const blocks = [];

  // Generate numbers and populate the blocks
  for (let i = 0; i < numBlocks; i += 1) {
    const block = [];
    for (let j = i * blockSize + 1; j <= (i + 1) * blockSize && j <= numTrialsTotal; j += 1) {
      block.push(j);
    }
    blocks.push(block.length);
  }

  return blocks;
};
