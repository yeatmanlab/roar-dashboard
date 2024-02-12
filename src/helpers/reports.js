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

export const taskInfoById = {
  swr: {
    color: '#E97A49',
    header: 'ROAR-WORD',
    subheader: 'Single Word Recognition',
    desc: "ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read fluently, students must master fundamental skills of decoding and automaticity. This test measures a student's ability to detect real and made-up words, which can then translate to a student's reading levels and need for support. The student's score will range between 100-900 and can be viewed by selecting 'Raw Score' on the table above. <br/><br/> Students in the pink category need support in word-level decoding. For these students, decoding difficulties are likely the bottleneck for growth in reading fluency and comprehension. Students in grades K-5 in the pink category have word-level decoding skills below 75% of their peers, nationally. Students in grades 6-12 in the pink category have word-level decoding skills below a third-grade level. <br/><br/> Students in the yellow category are still developing their decoding skills and will likely benefit from further practice and/or support in foundational reading skills. <br/><br/> Students in the green category demonstrate that word-level decoding is not holding them back from developing fluency and comprehension of connected text.",
    definitions: [
      {
        header: 'WHAT IS DECODING',
        desc: 'Decoding refers to the ability to sound out and recognize words by associating individual letters or groups of letters with their corresponding sounds. It involves applying knowledge of letter-sound relationships to read words accurately and fluently.',
      },
      {
        header: 'WHAT IS AUTOMATICITY?',
        desc: 'Automaticity refers to the ability to read words quickly and accurately without having to think about each letter or sound. It allows readers to focus more on understanding what they are reading instead of getting stuck on individual words.',
      },
    ],
  },
  pa: {
    header: 'ROAR-PHONEME',
    color: '#52627E',
    subheader: 'Phonological Awareness',
    desc: "ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching tasks. Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for achieving reading fluency. Without support for their foundational reading abilities, students may struggle to catch up in overall reading proficiency. The student's score will range between 0-57 and can be viewed by selecting 'Raw Score' on the table above.",
    definitions: [
      {
        header: 'What Does Elision Mean?',
        desc: 'Elision refers to the omission or deletion of a sound or syllable within a word. It involves the removal of specific sounds or syllables to create a more streamlined pronunciation. For example, the word "library" may be pronounced as "li-bry" by eliding the second syllable.',
      },
      {
        header: 'WHAT IS PHONOLOGICAL AWARENESS',
        desc: 'Phonological awareness is the ability to recognize and manipulate the sounds of spoken language. It involves an understanding of the individual sounds (phonemes), syllables, and words that make up spoken language. Phonological awareness skills include tasks like segmenting words into sounds, blending sounds to form words, and manipulating sounds within words.',
      },
    ],
  },
  sre: {
    header: 'ROAR-SENTENCE',
    color: '#92974C',
    subheader: 'SENTENCE READING EFFICIENCY',
    desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above. <br/><br/> Students in the pink category need support in sentence-reading efficiency to support growth in reading comprehension. Students in grades K-5 in the pink category have sentence-reading efficiency skills below 75% of their peers. Students in grades 6-12 in the pink category have sentence-reading efficiency skills below a third-grade level. <br/><br/> Students in the yellow category are still developing their sentence-reading efficiency skills and will benefit from focused reading practice. <br/><br/> Students in the green category demonstrate that sentence-reading efficiency is not a barrier in their reading.",
    definitions: [
      {
        header: 'WHAT IS FLUENCY?',
        desc: 'Fluency refers to the ability of a student to read text effortlessly, accurately, and with appropriate expression. It involves the skills of decoding words, recognizing sight words, and understanding the meaning of the text. Fluent readers demonstrate a smooth and natural reading pace, which enhances their overall comprehension and enjoyment of reading.',
      },
      {
        header: 'HOW DO THESE SKILLS RELATE TO THE OTHER ROAR ASSESSMENTS?',
        desc: 'ROAR-Sentence Reading Efficiency builds upon fundamental decoding and phonological awareness skills that are present in the ROAR-Word and ROAR-Phonological Awareness assessments. Therefore, if a student needs support with phonological awareness and single word recognition, then it is likely that they will struggle with the reading fluency skills measured by ROAR-Sentence Reading Efficiency.',
      },
    ],
  },
  morph: {
    header: 'ROAR-MORPHOLOGY (WIP)',
    subheader: 'Single Word Recognition',
    desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above.",
  },
  cva: {
    header: 'ROAR-CVA (WIP)',
    subheader: 'Single Word Recognition',
    desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above.",
  },
  letter: {
    color: '#E19834',
    header: 'ROAR-LETTER NAMES AND SOUNDS',
    subheader: 'Single Letter Recognition',
    desc: 'ROAR-Letter Names and Sounds assesses a student’s knowledge of letter names and letter sounds. Knowing letter names supports the learning of letter sounds, and knowing letter sounds supports the learning of letter names. Initial knowledge of letter names and letter sounds on entry to kindergarten has been shown to predict success in learning to read. Learning the connection between letters and the sounds they represent is fundamental for learning to decode and spell words. This assessment provides educators with valuable insights to customize instruction and address any gaps in these foundational skills.',
  },
};
