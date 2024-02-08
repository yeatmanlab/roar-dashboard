/*
 *  Task Display Names
 *  A map of all tasks, including their taskId, display name, and index for ordering
 *  Key: taskId
 *  Value: { orderindex, displayName }
 */
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

/*
 *  Descriptions By Task Id
 *  A map to correlate taskId with a proper header and description for use in the distribution graphs.
 */
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

/*
 *  Tasks to Display Graphs
 *  A list of tasks who, when included in a score report, will generate breaskdown graphs.
 */
export const tasksToDisplayGraphs = ['swr', 'sre', 'pa'];

/*
 *  Raw Only Tasks
 *  A list of tasks to only display raw scores when included in a RoarDataTable.
 */
export const rawOnlyTasks = ['letter', 'multichoice', 'vocab', 'fluency'];

/*
 *  Scored Tasks
 *  A list of tasks to be included in the generation of support levels
 */
export const scoredTasks = ['swr', 'pa', 'sre'];

/*
 *  Support Level Colors
 *  Colors corresponding to each support level.
 */
export const supportLevelColors = {
  above: 'green',
  some: '#edc037',
  below: '#c93d82',
};

/*
 *  Get Support Level
 *  Function to take scores, taskId, and grade and return the proper support category for the run.
 */
export const getSupportLevel = (grade, percentile, rawScore, taskId) => {
  let support_level = null;
  let tag_color = null;
  if (!scoredTasks.includes(taskId) && (rawScore || percentile)) {
    return {
      support_level: 'Scores Under Development',
      tag_color: 'white',
    };
  }
  if (percentile !== undefined && grade < 6) {
    if (percentile >= 50) {
      support_level = 'Achieved Skill';
      tag_color = supportLevelColors.above;
    } else if (percentile > 25 && percentile < 50) {
      support_level = 'Developing Skill';
      tag_color = supportLevelColors.some;
    } else {
      support_level = 'Needs Extra Support';
      tag_color = supportLevelColors.below;
    }
  } else if (rawScore !== undefined && grade >= 6) {
    const { above, some } = getRawScoreThreshold(taskId);
    if (rawScore >= above) {
      support_level = 'Achieved Skill';
      tag_color = supportLevelColors.above;
    } else if (rawScore > some && rawScore < above) {
      support_level = 'Developing Skill';
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

export const getRawScoreThreshold = (taskId) => {
  if (taskId === 'swr') {
    return {
      above: 550,
      some: 400,
    };
  } else if (taskId === 'sre') {
    return {
      above: 70,
      some: 47,
    };
  } else if (taskId === 'pa') {
    return {
      above: 55,
      some: 45,
    };
  }
  return null;
};
