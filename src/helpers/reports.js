import html2canvas from 'html2canvas';

/*
 *  Task Display Names
 *  A map of all tasks, including their taskId, display name, and index for ordering
 *  Key: taskId
 *  Value: { orderindex, displayName }
 */
export const taskDisplayNames = {
  letter: {
    name: 'Letter',
    extendedTitle: 'ROAR - Letter',
    extendedName: 'Letter Names and Sounds',
    order: 1,
  },
  'letter-es': {
    name: 'Letra',
    extendedTitle: 'ROAR - Letra',
    extendedName: 'Letter Names and Sounds',
    order: 2,
  },
  pa: { name: 'Phoneme', extendedTitle: 'ROAR - Phoneme', extendedName: 'Phonological Awareness', order: 3 },
  swr: { name: 'Word', extendedTitle: 'ROAR - Word', extendedName: 'Single Word Recognition', order: 4 },
  'swr-es': { name: 'Palabra', extendedTitle: 'ROAR - Word', extendedName: 'Single Word Recognition', order: 5 },
  sre: { name: 'Sentence', extendedTitle: 'ROAR - Sentence', extendedName: 'Sentence Reading Efficiency', order: 6 },
  'sre-es': { name: 'Frase', extendedTitle: 'ROAR - Frase', extendedName: 'Sentence Reading Efficiency', order: 7 },
  morphology: {
    name: 'Morphology',
    extendedTitle: 'ROAR - Morphology',
    extendedName: 'Morphological Awareness',
    order: 8,
  },
  cva: {
    name: 'Written-Vocab',
    extendedTitle: 'ROAR - Written Vocabulary',
    extendedName: 'Written Vocabulary',
    order: 9,
  },
  multichoice: {
    name: 'Multichoice',
    extendedTitle: 'ROAR - Multichoice',
    extendedName: 'Multiple Choice Vocabulary',
    order: 10,
  },
  vocab: {
    name: 'Vocabulary',
    extendedTitle: 'ROAR - Vocabulary',
    extendedName: 'Vocabulary',
    order: 11,
  },
  fluency: { name: 'Fluency', extendedTitle: 'ROAM - Fluency', extendedName: 'Math Fluency', order: 12 },
  'fluency-arf': {
    name: 'Single Digit Fluency',
    extendedTitle: 'ROAM - Single Digit',
    extendedName: 'Math Fluency - Single Digit',
    order: 13,
  },
  'fluency-arf-es': {
    name: 'Un Dígito',
    extendedTitle: 'ROAM - Un Dígito',
    extendedName: 'Math Fluency - Single Digit',
    order: 14,
  },
  'fluency-calf': {
    name: 'Multi Digit Fluency',
    extendedTitle: 'ROAM - Multi Digit',
    extendedName: 'Math Fluency - Multi Digit',
    order: 15,
  },
  'fluency-calf-es': {
    name: 'Varios Dígitos',
    extendedTitle: 'ROAM - Varios Dígitos',
    extendedName: 'Math Fluency - Multi Digit',
    order: 16,
  },
  syntax: { name: 'Syntax', extendedTitle: 'ROAR - Syntax', extendedName: 'Syntax', order: 17 },
  phonics: { name: 'Phonics', extendedTitle: 'ROAR - Phonics', extendedName: 'Phonics', order: 18 },
  comp: {
    name: 'Comprehension',
    extendedTitle: 'ROAR - Comprehension',
    extendedName: 'Reading Comprehension',
    order: 19,
  },
  mep: { name: 'MEP', extendedTitle: 'ROAR - MEP', extendedName: 'MEP', order: 20 },
  'mep-pseudo': { name: 'MEP-Pseudo', extendedTitle: 'ROAR - MEP Pseudo', extendedName: 'MEP-Pseudo', order: 21 },
  ExternalTask: {
    name: 'External Task',
    extendedTitle: 'ROAR - External Task',
    extendedName: 'External Task',
    order: 22,
  },
  ExternalTest: {
    name: 'External Test',
    extendedTitle: 'ROAR- External Test',
    extendedName: 'External Test',
    order: 23,
  },
};

export const extendedDescriptions = {
  swr: 'This test measures your student’s skill in reading single words quickly and correctly',
  'swr-es':
    'This test measures how well a student can identify real words and made-up words. ' +
    'The goal is for students to recognize words quickly and accurately, a skill called decoding. ' +
    'High scores on this assessment indicate a readiness to be a skilled and fluent reader',
  pa: 'This test measures how well your student can break down a spoken word into its individual sounds and choose or create a word with the same sounds',
  sre: 'This test measures how quickly your student can silently read and understand sentences',
  vocab: 'This test measures how well your student knows words by having them match a picture to a spoken word',
  multichoice: 'Temporary description for multichoice',
  morph:
    'This test measures how well your student understands how parts of words, including prefixes and suffixes, can change the meaning of a word in a sentence',
  cva: 'This test measures your students’ knowledge of words that are often used in the books they read at school',
  letter:
    'This test measures how well your student knows the names of letters and which letters are used to spell each sound',
  comp: 'Temporary description for comp',
  phonics:
    'This test measures phonics knowledge by testing how well your student can match the sounds of a word to the spelling',
  syntax: 'This test measures how well students understand sentences that vary from simple to complicated',
  fluency: 'Temporary description for fluency',
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

const pageWidth = 190; // Set page width for calculations
const returnScaleFactor = (width) => pageWidth / width; // Calculate the scale factor
// Helper function to add an element to a document and perform page break logic
export const addElementToPdf = async (element, document, yCounter, offset = 0) => {
  await html2canvas(element, { windowWidth: 1300, scale: 2 }).then(function (canvas) {
    const imgData = canvas.toDataURL('image/jpeg', 0.7, { willReadFrequently: true });
    const scaledCanvasHeight = canvas.height * returnScaleFactor(canvas.width);
    // Add a new page for each task if there is no more space in the page for task desc and graph
    if (yCounter + scaledCanvasHeight + offset > 287) {
      document.addPage();
      yCounter = 10;
    } else {
      // Add Margin
      yCounter += 5;
    }

    document.addImage(imgData, 'JPEG', 10, yCounter, pageWidth, scaledCanvasHeight);
    yCounter += scaledCanvasHeight;
  });
  return yCounter;
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
  if (percentile !== undefined && (grade < 6 || grade === 'K')) {
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

export function getScoreKeys(taskId, grade) {
  let percentileScoreKey = undefined;
  let percentileScoreDisplayKey = undefined;
  let standardScoreKey = undefined;
  let standardScoreDisplayKey = undefined;
  let rawScoreKey = undefined;
  if (taskId === 'swr' || taskId === 'swr-es') {
    if (grade < 6) {
      percentileScoreKey = 'wjPercentile';
      percentileScoreDisplayKey = 'wjPercentile';
      standardScoreKey = 'standardScore';
      standardScoreDisplayKey = 'standardScore';
    } else {
      percentileScoreKey = 'sprPercentile';
      percentileScoreDisplayKey = 'sprPercentile';
      standardScoreKey = 'sprStandardScore';
      standardScoreDisplayKey = 'sprStandardScore';
    }
    rawScoreKey = 'roarScore';
  }
  if (taskId === 'pa') {
    if (grade < 6) {
      percentileScoreKey = 'percentile';
      percentileScoreDisplayKey = 'percentile';
      standardScoreKey = 'standardScore';
      standardScoreDisplayKey = 'standardScore';
    } else {
      // These are string values intended for display
      //   they include '>' when the ceiling is hit
      // Replace them with non '-String' versions for
      //   comparison.
      percentileScoreKey = 'sprPercentile';
      percentileScoreDisplayKey = 'sprPercentileString';
      standardScoreKey = 'sprStandardScore';
      standardScoreDisplayKey = 'sprStandardScoreString';
    }
    rawScoreKey = 'roarScore';
  }
  if (taskId === 'sre') {
    if (grade < 6) {
      percentileScoreKey = 'tosrecPercentile';
      percentileScoreDisplayKey = 'tosrecPercentile';
      standardScoreKey = 'tosrecSS';
      standardScoreDisplayKey = 'tosrecSS';
    } else {
      percentileScoreKey = 'sprPercentile';
      percentileScoreDisplayKey = 'sprPercentile';
      standardScoreKey = 'sprStandardScore';
      standardScoreDisplayKey = 'sprStandardScore';
    }
    rawScoreKey = 'sreScore';
  }
  return {
    percentileScoreKey,
    percentileScoreDisplayKey,
    standardScoreKey,
    standardScoreDisplayKey,
    rawScoreKey,
  };
}

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

export const getRawScoreRange = (taskId) => {
  if (taskId.includes('swr')) {
    return {
      min: 100,
      max: 900,
    };
  } else if (taskId.includes('letter')) {
    return {
      min: 0,
      max: 90,
    };
  } else if (taskId.includes('pa')) {
    return {
      min: 0,
      max: 57,
    };
  } else if (taskId.includes('sre')) {
    return {
      min: 0,
      max: 130,
    };
  } else if (taskId.includes('morphology')) {
    return {
      min: 0,
      max: 130,
    };
  } else if (taskId.includes('cva')) {
    return {
      min: 0,
      max: 130,
    };
  }
  return null;
};

export const taskInfoById = {
  swr: {
    color: '#E97A49',
    header: 'ROAR-WORD',
    subheader: 'Single Word Recognition',
    desc: `ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read fluently, students must master fundamental skills of decoding and automaticity. This test measures a student's ability to detect real and made-up words, which can then translate to a student's reading levels and need for support. The student's score will range between ${
      getRawScoreRange('swr').min
    }-${
      getRawScoreRange('swr').max
    } and can be viewed by selecting 'Raw Score' on the table above. <br/><br/> Students in the pink category need support in word-level decoding. For these students, decoding difficulties are likely the bottleneck for growth in reading fluency and comprehension. Students in grades K-5 in the pink category have word-level decoding skills below 75% of their peers, nationally. Students in grades 6-12 in the pink category have word-level decoding skills below a third-grade level. <br/><br/> Students in the yellow category are still developing their decoding skills and will likely benefit from further practice and/or support in foundational reading skills. <br/><br/> Students in the green category demonstrate that word-level decoding is not holding them back from developing fluency and comprehension of connected text.`,
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
    desc:
      "ROAR - Phoneme assesses a student's mastery of phonological awareness " +
      'through elision and sound matching tasks. Research indicates that ' +
      'phonological awareness, as a foundational pre-reading skill, is crucial for ' +
      'achieving reading fluency. Without support for their foundational reading ' +
      'abilities, students may struggle to catch up in overall reading proficiency. ' +
      "The student's score will range between " +
      `${getRawScoreRange('pa').min}-${getRawScoreRange('pa').max} and can be ` +
      "viewed by selecting 'Raw Score' on the table above.",
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
    desc:
      'ROAR - Sentence examines silent reading fluency and comprehension for ' +
      'individual sentences. To become fluent readers, students need to decode ' +
      'words accurately and read sentences smoothly. Poor fluency can make it ' +
      "harder for students to understand what they're reading. Students who don't " +
      'receive support for their basic reading skills may find it challenging to ' +
      'improve their overall reading ability. This assessment is helpful for ' +
      'identifying students who may struggle with reading comprehension due to ' +
      'difficulties with decoding words accurately or reading slowly and with ' +
      `effort. The student's score will range between ${getRawScoreRange('sre').min}-${getRawScoreRange('sre').max} ` +
      "and can be viewed by selecting 'Raw Score' on the table above. < br />" +
      '<br /> Students in the pink category need support in sentence-reading ' +
      'efficiency to support growth in reading comprehension. Students in grades ' +
      'K-5 in the pink category have sentence-reading efficiency skills below 75% ' +
      'of their peers. Students in grades 6-12 in the pink category have ' +
      'sentence-reading efficiency skills below a third-grade level. < br />' +
      '<br /> Students in the yellow category are still developing their sentence' +
      '-reading efficiency skills and will benefit from focused reading ' +
      'practice. < br /> <br /> Students in the green category demonstrate that ' +
      'sentence-reading efficiency is not a barrier in their reading.',
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
    desc:
      'ROAR - Sentence examines silent reading fluency and comprehension for ' +
      'individual sentences. To become fluent readers, students need to decode ' +
      'words accurately and read sentences smoothly. Poor fluency can make it ' +
      "harder for students to understand what they're reading. Students who don't " +
      'receive support for their basic reading skills may find it challenging to ' +
      'improve their overall reading ability. This assessment is helpful for ' +
      'identifying students who may struggle with reading comprehension due to ' +
      'difficulties with decoding words accurately or reading slowly and with ' +
      `effort. The student's score will range between ${getRawScoreRange('morphology').min}-${
        getRawScoreRange('morphology').max
      } and can be viewed by ` +
      "selecting 'Raw Score' on the table above.",
  },
  cva: {
    header: 'ROAR-CVA (WIP)',
    subheader: 'Single Word Recognition',
    desc:
      'ROAR - Sentence examines silent reading fluency and comprehension for ' +
      'individual sentences. To become fluent readers, students need to decode ' +
      'words accurately and read sentences smoothly. Poor fluency can make it ' +
      "harder for students to understand what they're reading. Students who don't " +
      'receive support for their basic reading skills may find it challenging to ' +
      'improve their overall reading ability. This assessment is helpful for ' +
      'identifying students who may struggle with reading comprehension due to ' +
      'difficulties with decoding words accurately or reading slowly and with ' +
      `effort. The student's score will range between ${getRawScoreRange('cva').min}-${
        getRawScoreRange('cva').max
      } and can be viewed by ` +
      "selecting 'Raw Score' on the table above.",
  },
  letter: {
    color: '#E19834',
    header: 'ROAR-LETTER NAMES AND SOUNDS',
    subheader: 'Letter Names and Sounds',
    desc:
      "ROAR-Letter assesses a student's knowledge of letter " +
      'names and letter sounds. Knowing letter names supports the learning of ' +
      'letter sounds, and knowing letter sounds supports the learning of letter ' +
      'names. Initial knowledge of letter names and letter sounds on entry to ' +
      'kindergarten has been shown to predict success in learning to read. Learning ' +
      'the connection between letters and the sounds they represent is fundamental ' +
      'for learning to decode and spell words. This assessment provides educators ' +
      'with valuable insights to customize instruction and address any gaps in ' +
      'these foundational skills.',
  },
};
