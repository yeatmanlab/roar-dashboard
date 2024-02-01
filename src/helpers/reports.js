export const taskDisplayNames = {
  letter: { name: 'Letter Names and Sounds', order: 1 },
  pa: { name: 'Phoneme', order: 2 },
  swr: { name: 'Word', order: 3 },
  'swr-es': { name: 'Palabra', order: 4 },
  sre: { name: 'Sentence', order: 5 },
  morphology: { name: 'Morphology', order: 6 },
  cva: { name: 'Written-Vocab', order: 7 },
  multichoice: { name: 'Multichoice', order: 8 },
  fluency: { name: 'Fluency', order: 9 },
  mep: { name: 'MEP', order: 10 },
  'mep-pseudo': { name: 'MEP-Pseudo', order: 11 },
  ExternalTask: { name: 'External Task', order: 12 },
  ExternalTest: { name: 'External Test', order: 13 },
};

export const descriptionsByTaskId = {
  // "letter": { header: "ROAR-Letter Sound Matching (ROAR-Letter)", description: " assesses knowledge of letter names and sounds." },
  pa: {
    header: 'ROAR-Phonological Awareness (ROAR-Phoneme)',
    description:
      ' measures the ability to hear and manipulate the individual sounds within words (sound matching and elision). This skill is crucial for building further reading skills, such as decoding.',
  },
  swr: {
    header: 'ROAR-Single Word Recognition (ROAR-Word)',
    description: ' assesses decoding skills at the word level.',
  },
  sre: {
    header: 'ROAR-Sentence Reading Efficiency (ROAR-Sentence)',
    description: ' assesses reading fluency at the sentence level.',
  },
};

export const tasksToDisplayGraphs = ['swr', 'sre', 'pa'];

export const excludedTasks = ['cva', 'morphology'];

export const taskFilterBlacklist = ['letter'];

export const supportLevelColors = {
  above: 'green',
  some: '#edc037',
  below: '#c93d82',
};

// function should also accept raw score and grade
export const getSupportLevel = (grade, percentile, rawScore, taskId) => {
  let support_level = null;
  let tag_color = null;
  if (percentile !== undefined && grade < 6 && !['swr, pa'].includes(taskId)) {
    if (percentile >= 50) {
      support_level = 'At or Above Average';
      tag_color = supportLevelColors.above;
    } else if (percentile > 25 && percentile < 50) {
      support_level = 'Needs Some Support';
      tag_color = supportLevelColors.some;
    } else {
      support_level = 'Needs Extra Support';
      tag_color = supportLevelColors.below;
    }
  } else if (rawScore !== undefined && grade >= 6) {
    const { above, some } = getRawScoreThreshold(taskId);
    if (rawScore >= above) {
      support_level = 'At or Above Average';
      tag_color = supportLevelColors.above;
    } else if (rawScore > some && percentile < above) {
      support_level = 'Needs Some Support';
      tag_color = supportLevelColors.some;
    } else {
      support_level = 'Needs Extra Support';
      tag_color = supportLevelColors.below;
    }
  }
  return {
    support_level,
    tag_color,
  };
};

const getRawScoreThreshold = (taskId) => {
  if (taskId === 'swr') {
    return {
      above: 550,
      some: 400,
    };
  } else if (taskId === 'sre') {
    return {
      above: 47,
      some: 73,
    };
    // } else if (taskId === 'pa') {
    //   return {
    //     above: 1,
    //     some: 1,
    //   };
  }
  return null;
};
