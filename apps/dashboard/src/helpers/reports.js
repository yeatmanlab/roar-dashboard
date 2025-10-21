import html2canvas from 'html2canvas';
import { toValue } from 'vue';
import { getGrade } from '@bdelab/roar-utils';
import { LEVANTE_TASK_IDS_NO_SCORES } from '../constants/levanteTasks';
/*
 *  Task Display Names
 *  A map of all tasks, including their taskId, display name, and index for ordering
 *  Key: taskId
 *  Value: { orderindex, displayName }
 */

export const taskDisplayNames = {
  letter: {
    name: 'Letter',
    publicName: 'ROAR - Letter',
    studentFacingName: 'Letter',
    extendedTitle: 'ROAR - Letter',
    extendedName: 'Letter Names and Sounds',
    order: 1,
  },
  'letter-es': {
    name: 'Letra',
    publicName: 'ROAR - Letra',
    studentFacingName: 'Letra',
    extendedTitle: 'ROAR - Letra',
    extendedName: 'Letter Names and Sounds',
    order: 2,
  },
  'letter-en-ca': {
    name: 'Letter',
    publicName: 'ROAR - Letter',
    studentFacingName: 'Letter',
    extendedTitle: 'ROAR - Letter',
    extendedName: 'Letter Names and Sounds',
    order: 27,
  },
  phonics: {
    name: 'Phonics',
    publicName: 'ROAR - Phonics',
    studentFacingName: 'Phonics',
    extendedTitle: 'ROAR - Phonics',
    extendedName: 'Phonics Assessment',
    order: 28,
  },
  pa: {
    name: 'Phoneme',
    publicName: 'ROAR - Phoneme',
    studentFacingName: 'Phoneme',
    extendedTitle: 'ROAR - Phoneme',
    extendedName: 'Phonological Awareness',
    order: 3,
  },
  'pa-es': {
    name: 'Fonema',
    publicName: 'ROAR - Fonema',
    studentFacingName: 'Fonema',
    extendedTitle: 'ROAR - Fonema',
    extendedName: 'Phonological Awareness',
    order: 4,
  },
  swr: {
    name: 'Word',
    publicName: 'ROAR - Word',
    studentFacingName: 'Word',
    extendedTitle: 'ROAR - Word',
    extendedName: 'Single Word Recognition',
    order: 5,
  },
  'swr-es': {
    name: 'Palabra',
    publicName: 'ROAR - Palabra',
    studentFacingName: 'Palabra',
    extendedTitle: 'ROAR - Word',
    extendedName: 'Single Word Recognition',
    order: 50,
  },
  sre: {
    name: 'Sentence',
    publicName: 'ROAR - Sentence',
    studentFacingName: 'Sentence',
    extendedTitle: 'ROAR - Sentence',
    extendedName: 'Sentence Reading Efficiency',
    order: 7,
  },
  'sre-es': {
    name: 'Frase',
    publicName: 'ROAR - Frase',
    studentFacingName: 'Frase',
    extendedTitle: 'ROAR - Frase',
    extendedName: 'Sentence Reading Efficiency',
    order: 51,
  },
  morphology: {
    name: 'Morphology',
    publicName: 'ROAR - Morphology',
    studentFacingName: 'Morphology',
    extendedTitle: 'ROAR - Morphology',
    extendedName: 'Morphological Awareness',
    order: 9,
  },
  cva: {
    name: 'Written-Vocab',
    publicName: 'ROAR - Written Vocab',
    studentFacingName: 'Written Vocab',
    extendedTitle: 'ROAR - Written Vocabulary',
    extendedName: 'Written Vocabulary',
    order: 10,
  },
  multichoice: {
    name: 'Multichoice',
    publicName: 'ROAR - Multichoice',
    studentFacingName: 'Multichoice',
    extendedTitle: 'ROAR - Multichoice',
    extendedName: 'Multiple Choice Vocabulary',
    order: 11,
  },
  vocab: {
    name: 'Picture-Vocab',
    publicName: 'ROAR - Picture Vocab',
    studentFacingName: 'Picture Vocab',
    extendedTitle: 'ROAR - Picture Vocabulary',
    extendedName: 'Picture Vocabulary',
    order: 12,
  },
  fluency: {
    name: 'Fluency',
    publicName: 'ROAR - Fluency',
    studentFacingName: 'Fluency',
    extendedTitle: 'ROAM - Fluency',
    extendedName: 'Math Fluency',
    order: 12,
  },
  'fluency-arf': {
    name: 'Single Digit Fluency',
    publicName: 'ROAM - Math Facts',
    studentFacingName: 'Math Facts',
    extendedTitle: 'ROAM - Single Digit',
    extendedName: 'Math Fluency - Single Digit',
    order: 13,
  },
  'fluency-arf-es': {
    name: 'Un Dígito',
    publicName: 'ROAR - Un Dígito',
    studentFacingName: 'Un Dígito',
    extendedTitle: 'ROAM - Un Dígito',
    extendedName: 'Math Fluency - Single Digit',
    order: 14,
  },
  'fluency-calf': {
    name: 'Multi Digit Fluency',
    publicName: 'ROAR - Calculation Fluency',
    studentFacingName: 'Calculation Fluency',
    extendedTitle: 'ROAM - Multi Digit',
    extendedName: 'Math Fluency - Multi Digit',
    order: 15,
  },
  'fluency-calf-es': {
    name: 'Varios Dígitos',
    publicName: 'ROAR - Varios Dígitos',
    studentFacingName: 'Varios Dígitos',
    extendedTitle: 'ROAM - Varios Dígitos',
    extendedName: 'Math Fluency - Multi Digit',
    order: 16,
  },
  'roam-alpaca': {
    name: 'Core - Math',
    publicName: 'ROAM - Core Math',
    studentFacingName: 'Core Math',
    extendedTitle: 'ROAM - Core Math',
    extendedName: 'Core Math - Alpaca',
    order: 28,
  },
  'roam-alpaca-es': {
    name: 'Matemáticas Centrales',
    publicName: 'ROAM - Matematica Central',
    studentFacingName: 'Matematica Central',
    extendedTitle: 'ROAM - Matemática Central',
    extendedName: 'Matemáticas Centrales',
    order: 29,
  },
  roar_readaloud: {
    name: 'Read Aloud',
    publicName: 'ROAR - Read Aloud',
    studentFacingName: 'Read Aloud',
    extendedTitle: 'ROAR - Read Aloud',
    extendedName: 'Read Aloud',
    order: 30,
  },
  'roar-readaloud': {
    name: 'Read Aloud',
    publicName: 'ROAR - Read Aloud',
    studentFacingName: 'Read Aloud',
    extendedTitle: 'ROAR - Read Aloud',
    extendedName: 'Read Aloud',
    order: 30,
  },
  syntax: {
    name: 'Syntax',
    publicName: 'ROAR - Syntax',
    studentFacingName: 'Syntax',
    extendedTitle: 'ROAR - Syntax',
    extendedName: 'Syntax',
    order: 17,
  },
  trog: {
    name: 'Syntax',
    publicName: 'ROAR - Syntax',
    studentFacingName: 'Syntax',
    extendedTitle: 'ROAR - Syntax',
    extendedName: 'Syntax',
    order: 17,
  },
  roarInference: {
    name: 'Inference',
    publicName: 'ROAR - Inference',
    studentFacingName: 'Inference',
    extendedTitle: 'ROAR - Inference',
    extendedName: 'Inference',
    order: 27,
  },
  comp: {
    name: 'Comprehension',
    publicName: 'ROAR - Comprehension',
    extendedTitle: 'ROAR - Comprehension',
    studentFacingName: 'Comprehension',
    extendedName: 'Reading Comprehension',
    order: 19,
  },
  mep: {
    name: 'MEP',
    publicName: 'ROAR - Multi-Element Processing',
    studentFacingName: 'Multi-Element Processing',
    extendedTitle: 'ROAR - MEP',
    extendedName: 'MEP',
    order: 20,
  },
  'mep-pseudo': {
    name: 'MEP-Pseudo',
    publicName: 'ROAR - MEP Pseudo',
    studentFacingName: 'Multi-Element Processing-Pseudo',
    extendedTitle: 'ROAR - MEP Pseudo',
    extendedName: 'MEP-Pseudo',
    order: 21,
  },
  ExternalTask: {
    name: 'External Task',
    publicName: 'ROAR - External Task',
    extendedTitle: 'ROAR - External Task',
    extendedName: 'External Task',
    studentFacingName: 'External Task',
    order: 22,
  },
  ran: {
    name: 'RAN',
    publicName: 'ROAV - RAN',
    studentFacingName: 'RAN',
    extendedTitle: 'ROAV - RAN',
    extendedName: 'RAN',
    order: 23,
  },
  crowding: {
    name: 'Crowding',
    publicName: 'ROAV - Crowding',
    extendedTitle: 'ROAV - Crowding',
    extendedName: 'Crowding',
    order: 24,
  },
  'roav-mep': {
    name: 'MEP',
    publicName: 'ROAV - Multi-Element Processing',
    studentFacingName: 'Multi-Element Processing',
    extendedTitle: 'ROAV - MEP',
    extendedName: 'MEP',
    order: 25,
  },
  ExternalTest: {
    name: 'External Test',
    publicName: 'ROAR - External Test',
    studentFacingName: 'External Test',
    extendedTitle: 'ROAR - External Test',
    extendedName: 'External Test',
    order: 26,
  },
  'roar-survey': {
    name: 'Survey',
    publicName: 'ROAR - Survey',
    studentFacingName: 'Survey',
    extendedTitle: 'ROAR - Survey',
    extendedName: 'Survey',
    order: 27,
  },
};

export const extendedDescriptions = {
  swr: 'This test measures your student’s skill in reading single words quickly and correctly.',
  'swr-es':
    'This test measures how well a student can identify real words and made-up words. ' +
    'The goal is for students to recognize words quickly and accurately, a skill called decoding. ' +
    'High scores on this assessment indicate a readiness to be a skilled and fluent reader.',
  pa: 'This test measures how well your student can break down a spoken word into its individual sounds and choose or create a word with the same sounds.',
  sre: 'This test measures how quickly your student can silently read and understand sentences.',
  vocab: 'This test measures how well your student knows words by having them match a picture to a spoken word.',
  multichoice: 'Temporary description for multichoice',
  morph:
    'This test measures how well your student understands how parts of words, including prefixes and suffixes, can change the meaning of a word in a sentence',
  cva: 'This test measures your students’ knowledge of words that are often used in the books they read at school',
  letter:
    'This test measures how well your student knows the names of letters and which letters are used to spell each sound',
  'letter-en-ca':
    'This test measures how well your student knows the names of letters and which letters are used to spell each sound',
  'letter-es.':
    'This test measures how well your student knows the names of letters and which letters are used to spell each sound.',
  comp: 'Temporary description for comp',
  phonics:
    "This is a new test of phonics knowledge. It is currently being studied to determine how well it measures a student's ability to use phonics patterns to decode nonsense words.",
  syntax: 'This test measures how well students understand sentences that vary from simple to complicated',
  trog: 'This test measures how well students understand sentences that vary from simple to complicated',
  fluency: 'Temporary description for fluency',
  ran: 'Temporary description for ran',
  crowding: 'Temporary description for crowding',
  'roav-mep': 'Temporary description for mep',
  'roar-readaloud': 'Temporary description for readaloud',
  'roar-survey': 'Temporary description for survey',
};

/*
 *  Descriptions By Task Id
 *  A map to correlate taskId with a proper header and description for use in the distribution graphs.
 */
export const descriptionsByTaskId = {
  // "letter": { header: "ROAR-Letter Sound Matching (ROAR-Letter)", description: " assesses knowledge of letter names and sounds." },
  pa: {
    header: 'ROAR-Phonological Awareness (ROAR-Phoneme)',
    description: ' measures the ability to hear and manipulate the individual sounds within words.',
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

export const includedValidityFlags = {
  pa: ['incomplete'],
  'pa-es': ['incomplete'],
  sre: ['incomplete', 'responseTimeTooFast'],
  'sre-es': ['incomplete', 'responseTimeTooFast'],
  swr: ['responseTimeTooFast', 'notEnoughResponses'], // adding 'notEnoughResponses' for SWR since there is no current flag in the game to mark as incomplete like SRE does
  'swr-es': ['responseTimeTooFast', 'notEnoughResponses'],
};

/*
 *  Tasks to Display Graphs
 *  A list of tasks who, when included in a score report, will generate breakdown graphs.
 */
export const tasksToDisplayGraphs = ['swr', 'sre', 'pa'];

/*
 *  Raw Only Tasks
 *  A list of tasks to only display raw scores when included in a RoarDataTable.
 */
export const rawOnlyTasks = ['cva', 'morphology', 'vocab', 'fluency', 'roar-readaloud'];

/*
 *  Excluded from Score Report Apps
 *  A list of tasks to be excluded from a RoarDataTable because they do not have scores.
 *  However, these tasks will still be included in the progress report.
 */
export const excludeFromScoringTasks = [
  'roar-readaloud',
  'roav-mep',
  'ran',
  'roav-crowding',
  'external-test-task',
  'qualtrics-experience',
  'roar-survey',
  ...LEVANTE_TASK_IDS_NO_SCORES,
];

export const includeReliabilityFlagsOnExport = ['Word', 'Letter', 'Phoneme', 'Sentence', 'Palabra', 'Frase'];

/*
 *  Tasks to Display Percent Correct
 */
export const tasksToDisplayPercentCorrect = [
  'letter',
  'letter-es',
  'letter-en-ca',
  'phonics',
  'cva',
  'pa-es',
  'morphology',
  'vocab',
  'trog',
  'crowding',
  'mep',
  'roav-mep',
  'mep-pseudo',
  'roar-inference',
];

/*
 *  Tasks to Display total numCorrect
 */
export const tasksToDisplayTotalCorrect = [
  'fluency',
  'fluency-arf',
  'fluency-calf',
  'fluency-arf-es',
  'fluency-calf-es',
];

/*
 *  Tasks to Display total numCorrect grade estimate and support level
 */
export const tasksToDisplayGradeEstimate = ['roam-alpaca', 'phonics'];

/*
 *  Tasks to Display numCorrect - numIncorrect
 */
export const tasksToDisplayCorrectIncorrectDifference = ['sre-es'];

/*
 *  Scored Tasks
 *  A list of tasks to be included in the generation of support levels
 */
export const scoredTasks = ['swr', 'pa', 'sre'];

/*
 *  Fluency Tasks
 *  Temporary variable to differentiate from tasksToDisplayTotalCorrect for backward compatibility
 */
export const roamFluencyTasks = ['fluency-arf', 'fluency-calf', 'fluency-arf-es', 'fluency-calf-es'];

/*
 *  Tasks with subskills that require tooltips for subscore table.
 */
export const subskillTasks = ['roam-alpaca', ...roamFluencyTasks];

/*
 *  Support Level Colors
 *  Colors corresponding to each support level.
 */
export const supportLevelColors = {
  above: '#22c55e', // green-500
  Green: '#22c55e', // green-500
  some: '#edc037', // yellow
  Yellow: '#edc037', // yellow
  below: '#c93d82', // pink
  Pink: '#c93d82', // pink
  optional: '#71717a', // gray-500
  Optional: '#71717a', // gray-500
  Assessed: '#3b82f6', // blue-500
  Unreliable: '#d6b8c7', // pink-200
};

export const progressTags = {
  Optional: {
    value: 'optional',
    icon: 'pi pi-question',
    severity: 'info',
  },
  Completed: {
    value: 'completed',
    icon: 'pi pi-check',
    severity: 'success',
  },
  Started: {
    value: 'started',
    icon: 'pi pi-spinner-dotted',
    severity: 'warning',
  },
  Assigned: {
    value: 'assigned',
    icon: 'pi pi-book',
    severity: 'danger',
  },
};

// Grab grade options for filter dropdown
export const gradeOptions = [
  {
    value: '1',
    label: '1st Grade',
  },
  {
    value: '2',
    label: '2nd Grade',
  },
  {
    value: '3',
    label: '3rd Grade',
  },
  {
    value: '4',
    label: '4th Grade',
  },
  {
    value: '5',
    label: '5th Grade',
  },
  {
    value: '6',
    label: '6th Grade',
  },
  {
    value: '7',
    label: '7th Grade',
  },
  {
    value: '8',
    label: '8th Grade',
  },
  {
    value: '9',
    label: '9th Grade',
  },
  {
    value: '10',
    label: '10th Grade',
  },
  {
    value: '11',
    label: '11th Grade',
  },
  {
    value: '12',
    label: '12th Grade',
  },
];

export const roamAlpacaSubskills = {
  numberKnowledge: 'Number Knowledge',
  geometry: 'Geometry',
  arithmeticExpressions: 'Arithmetic Expressions',
  rationalNumbersProbability: 'Rational Numbers & Probability',
  algebraicThinking: 'Algebraic Thinking',
};

export const roamAlpacaSubskillHeaders = {
  rawScore: 'Num Correct',
  numAttempted: 'Num Attempted',
  percentCorrect: 'Percent Correct',
  gradeEstimate: 'Grade Estimate',
  supportLevel: 'Support Level',
};

export const roamFluencySubskillHeaders = {
  rawScore: 'Raw Score',
  numCorrect: 'Num Correct',
  numIncorrect: 'Num Incorrect',
  numAttempted: 'Num Attempted',
};

function getOrdinalSuffix(n) {
  if (n >= 11 && n <= 13) return 'th';

  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export function getGradeToDisplay(grade) {
  const gradeLevel = getGrade(grade);

  if (grade === 'Pre-K') {
    return 'Prekindergarten';
  }

  if (grade === 'K') {
    return 'Kindergarten';
  }

  if (typeof gradeLevel !== 'number' || gradeLevel < 0) {
    console.error('Invalid grade provided'); // For Sentry logging
    return null;
  }

  const suffix = getOrdinalSuffix(gradeLevel);
  return `${gradeLevel}${suffix} Grade`;
}

export function getGradeWithSuffix(grade) {
  const gradeLevel = getGrade(grade);

  if (grade === 'Pre-K') {
    return 'Pre-K';
  }

  if (grade === 'T-K') {
    return 'Transitional-K';
  }

  if (grade === 'K') {
    return 'K';
  }

  if (typeof gradeLevel !== 'number' || gradeLevel < 1) {
    return grade;
  }

  return `${gradeLevel}${getOrdinalSuffix(gradeLevel)}`;
}

/**
 * Returns the color to be used for a dial based on grade, percentile, raw score, and task ID.
 *
 * @param {string} grade - The grade level of the student (e.g., 'K', '1', 'Pre-K').
 * @param {number|null} percentile - The percentile score for the student (may be null).
 * @param {number|null} rawScore - The raw score for the student (may be null).
 * @param {string} taskId - The ID of the task (e.g., 'letter', 'phonics').
 * @param {any} [optional=null] - Optional additional data for scoring.
 * @param {string|null} [scoringVersion=null] - Optional scoring version identifier.
 * @returns {string} The CSS color variable to use for the dial.
 */
export const getDialColor = (grade, percentile, rawScore, taskId, optional = null, scoringVersion = null) => {
  if (taskId === 'letter' || taskId === 'letter-en-ca' || taskId === 'phonics') {
    return '#3b82f6'; // blue-500
  }
  const { tag_color, support_level } = getSupportLevel(grade, percentile, rawScore, taskId, optional, scoringVersion);
  console.log('[DEBUG] getDialColor:', {
    inputs: { grade, percentile, rawScore, taskId },
    result: { tag_color, support_level },
  });
  return tag_color;
};

export const getSupportLevel = (grade, percentile, rawScore, taskId, optional = null, scoringVersion = null) => {
  let support_level = null;
  let tag_color = null;

  const gradeLevel = getGrade(grade);

  if (rawScore === undefined) {
    return {
      support_level,
      tag_color,
    };
  }

  if (optional) {
    return {
      support_level: 'Optional',
      tag_color: supportLevelColors.Optional,
    };
  }

  if (
    ((tasksToDisplayPercentCorrect.includes(taskId) && !(taskId === 'swr-es' && scoringVersion >= 1)) ||
      tasksToDisplayTotalCorrect.includes(taskId)) &&
    tasksToDisplayGradeEstimate.includes(taskId) &&
    rawScore !== undefined
  ) {
    return {
      support_level: 'Raw Score',
      tag_color: supportLevelColors.Assessed,
    };
  }
  // Try percentile-based scoring for grades < 6
  if (percentile !== null && percentile !== undefined && gradeLevel < 6) {
    const isUpdatedSre = taskId === 'sre' && scoringVersion >= 4;
    const isUpdatedSreEs = taskId === 'sre-es' && scoringVersion >= 1;
    const isUpdatedSwr = taskId === 'swr' && scoringVersion >= 7;
    const isUpdatedSwrEs = taskId === 'swr-es' && scoringVersion >= 1;
    const useUpdatedNorms = isUpdatedSwr || isUpdatedSwrEs || isUpdatedSre || isUpdatedSreEs;
    const [achievedCutOff, developingCutOff] = useUpdatedNorms ? [40, 20] : [50, 25];
    if (percentile >= achievedCutOff) {
      support_level = 'Achieved Skill';
      tag_color = supportLevelColors.above;
    } else if (percentile > developingCutOff && percentile < achievedCutOff) {
      support_level = 'Developing Skill';
      tag_color = supportLevelColors.some;
    } else {
      support_level = 'Needs Extra Support';
      tag_color = supportLevelColors.below;
    }
  }

  // Fall back to raw score-based scoring if percentile is not available or grade >= 6
  if (support_level === null && rawScore !== null && rawScore !== undefined) {
    const { above, some } = getRawScoreThreshold(taskId, scoringVersion);

    // Only return support_level and tag_color if the thresholds are not null
    if (above != null && some != null) {
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
  }
  return {
    support_level,
    tag_color,
  };
};

export function getTagColor(supportLevel) {
  if (supportLevel === 'Needs Extra Support') {
    return supportLevelColors.below;
  } else if (supportLevel === 'Developing Skill') {
    return supportLevelColors.some;
  } else if (supportLevel === 'Achieved Skill') {
    return supportLevelColors.above;
  }
  return supportLevelColors.Assessed;
}

const ALLOWED_SCORE_FIELD_TYPES = [
  'percentile',
  'standardScore',
  'rawScore',
  'percentileDisplay',
  'standardScoreDisplay',
];

/**
 * Score Field Mapping Configuration
 * @desc Defines new and legacy field names for each task and grade combination
 *       This allows for backwards compatibility when field names are updated
 * @see ./SCORE_FIELD_MIGRATION_GUIDE.md
 */
const SCORE_FIELD_MAPPINGS = {
  swr: {
    percentile: {
      new: 'percentile',
      legacy: 'wjPercentile', // Same for now, but can be updated
    },
    percentileDisplay: {
      new: 'percentile',
      legacy: 'wjPercentile',
    },
    standardScore: {
      new: 'standardScore',
      legacy: 'standardScore',
    },
    standardScoreDisplay: {
      new: 'standardScore',
      legacy: 'standardScore',
    },
    rawScore: {
      new: 'roarScore',
      legacy: 'roarScore',
    },
  },
  'swr-es': {
    percentile: {
      new: 'percentile',
      legacy: 'wjPercentile',
    },
    percentileDisplay: {
      new: 'percentile',
      legacy: 'wjPercentile',
    },
    standardScore: {
      new: 'standardScore',
      legacy: 'standardScore',
    },
    standardScoreDisplay: {
      new: 'standardScore',
      legacy: 'standardScore',
    },
    rawScore: {
      new: 'roarScore',
      legacy: 'roarScore',
    },
  },
  pa: {
    percentile: {
      new: (gradeLevel) => (gradeLevel < 6 ? 'percentile' : 'sprPercentile'),
      legacy: (gradeLevel) => (gradeLevel < 6 ? 'percentile' : 'sprPercentile'),
    },
    percentileDisplay: {
      new: (gradeLevel) => (gradeLevel < 6 ? 'percentile' : 'sprPercentileString'),
      legacy: (gradeLevel) => (gradeLevel < 6 ? 'percentile' : 'sprPercentileString'),
    },
    standardScore: {
      new: (gradeLevel) => (gradeLevel < 6 ? 'standardScore' : 'sprStandardScore'),
      legacy: (gradeLevel) => (gradeLevel < 6 ? 'standardScore' : 'sprStandardScore'),
    },
    standardScoreDisplay: {
      new: (gradeLevel) => (gradeLevel < 6 ? 'standardScore' : 'sprStandardScoreString'),
      legacy: (gradeLevel) => (gradeLevel < 6 ? 'standardScore' : 'sprStandardScoreString'),
    },
    rawScore: {
      new: 'roarScore',
      legacy: 'roarScore',
    },
  },
  sre: {
    percentile: {
      new: 'percentile',
      legacy: (gradeLevel) => (gradeLevel < 6 ? 'tosrecPercentile' : 'sprPercentile'),
    },
    percentileDisplay: {
      new: 'percentile',
      legacy: (gradeLevel) => (gradeLevel < 6 ? 'tosrecPercentile' : 'sprPercentile'),
    },
    standardScore: {
      new: 'standardScore',
      legacy: (gradeLevel) => (gradeLevel < 6 ? 'tosrecSS' : 'sprStandardScore'),
    },
    standardScoreDisplay: {
      new: 'standardScore',
      legacy: (gradeLevel) => (gradeLevel < 6 ? 'tosrecSS' : 'sprStandardScore'),
    },
    rawScore: {
      new: 'sreScore',
      legacy: 'sreScore',
    },
  },
  'sre-es': {
    percentile: {
      new: 'percentile',
    },
    percentileDisplay: {
      new: 'percentile',
    },
    standardScore: {
      new: 'standardScore',
    },
    standardScoreDisplay: {
      new: 'standardScore',
    },
    rawScore: {
      new: 'sreScore',
    },
  },
  letter: {
    percentile: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    percentileDisplay: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    standardScore: {
      new: undefined,
      legacy: undefined,
    },
    standardScoreDisplay: {
      new: undefined,
      legacy: undefined,
    },
    rawScore: {
      new: 'totalCorrect',
      legacy: 'totalCorrect',
    },
  },
  'letter-es': {
    percentile: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    percentileDisplay: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    standardScore: {
      new: undefined,
      legacy: undefined,
    },
    standardScoreDisplay: {
      new: undefined,
      legacy: undefined,
    },
    rawScore: {
      new: 'totalCorrect',
      legacy: 'totalCorrect',
    },
  },
  'letter-en-ca': {
    percentile: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    percentileDisplay: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    standardScore: {
      new: undefined,
      legacy: undefined,
    },
    standardScoreDisplay: {
      new: undefined,
      legacy: undefined,
    },
    rawScore: {
      new: 'totalCorrect',
      legacy: 'totalCorrect',
    },
  },
  phonics: {
    percentile: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    percentileDisplay: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    standardScore: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    standardScoreDisplay: {
      new: 'totalPercentCorrect',
      legacy: 'totalPercentCorrect',
    },
    rawScore: {
      new: 'totalCorrect',
      legacy: 'totalCorrect',
    },
  },
};

/**
 * Resolves field name based on task, grade, and field type
 * @param {string} taskId - The task identifier
 * @param {number} grade - The grade level
 * @param {string} fieldType - The type of field (percentile, standardScore, etc.)
 * @param {boolean} isLegacy - Whether to use legacy field names
 * @see ./SCORE_FIELD_MIGRATION_GUIDE.md
 * @returns {string|undefined} The resolved field name
 */
function resolveFieldName(taskId, grade, fieldType, isLegacy = false) {
  if (!ALLOWED_SCORE_FIELD_TYPES.includes(fieldType)) {
    throw new Error(`Invalid fieldType. Expected one of ${ALLOWED_SCORE_FIELD_TYPES.join(', ')}, but got ${fieldType}`);
  }

  const taskMapping = SCORE_FIELD_MAPPINGS[taskId];
  if (!taskMapping || !taskMapping[fieldType]) {
    return undefined;
  }

  const fieldMapping = taskMapping[fieldType];
  const fieldName = isLegacy ? fieldMapping.legacy : fieldMapping.new;

  // Handle function-based field names (grade-dependent)
  if (typeof fieldName === 'function') {
    return fieldName(grade);
  }

  return fieldName;
}

/**
 * Safely accesses a score value from a scores object with fallback to legacy field names
 * @param {Object} scoresObject - The scores object to access
 * @param {string} taskId - The task identifier
 * @param {number} grade - The grade level
 * @param {string} fieldType - The type of field to access
 * @see ./SCORE_FIELD_MIGRATION_GUIDE.md
 * @returns {*} The score value or undefined if not found
 */
export function getScoreValue(scoresObject, taskId, grade, fieldType) {
  if (!scoresObject || !taskId || fieldType === undefined) {
    return undefined;
  }

  const gradeValue = toValue(grade);

  // Try new field name first
  const newFieldName = resolveFieldName(taskId, gradeValue, fieldType, false);
  if (newFieldName && scoresObject[newFieldName] !== undefined) {
    let scoreValue = scoresObject[newFieldName];
    if (
      (fieldType === 'percentile' || fieldType === 'standardScore') &&
      typeof scoreValue === 'string' &&
      scoreValue.match(/[<>]/).length > 0
    ) {
      scoreValue = parseFloat(scoreValue.replace(/[<>]/g, ''));
    }
    return scoreValue;
  }

  // Fall back to legacy field name
  const legacyFieldName = resolveFieldName(taskId, gradeValue, fieldType, true);
  if (legacyFieldName && scoresObject[legacyFieldName] !== undefined) {
    return scoresObject[legacyFieldName];
  }

  return undefined;
}

export const getRawScoreThreshold = (taskId, scoringVersion) => {
  if (taskId === 'swr') {
    if (scoringVersion >= 7) {
      return {
        above: 513,
        some: 413,
      };
    }
    return {
      above: 550,
      some: 400,
    };
  } else if (taskId === 'swr-es') {
    if (scoringVersion >= 1) {
      return {
        above: 547,
        some: 447,
      };
    }
  } else if (taskId === 'sre') {
    if (scoringVersion >= 4) {
      return {
        above: 41,
        some: 23,
      };
    }
    return {
      above: 70,
      some: 47,
    };
  } else if (taskId === 'sre-es') {
    if (scoringVersion >= 1) {
      return {
        above: 25,
        some: 12,
      };
    }
  } else if (taskId === 'pa') {
    return {
      above: 55,
      some: 45,
    };
  }
  return { above: null, some: null };
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
  } else if (taskId.includes('phonics')) {
    return {
      min: 0,
      max: 150,
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
  phonics: {
    color: '#4B7BE5',
    header: 'ROAR-PHONICS',
    subheader: 'Phonics Assessment',
    desc: 'ROAR - Phonics evaluates a students understanding of letter-sound relationships and their ability to decode words using phonics skills. The assessment covers various phonics patterns including CVC words, digraphs, blends, r-controlled vowels, silent e, and vowel teams. Each category measures the students proficiency in recognizing and applying specific phonics patterns, which is essential for developing strong reading skills.',
    definitions: [
      {
        header: 'WHAT ARE PHONICS PATTERNS?',
        desc: 'Phonics patterns are consistent relationships between letters and sounds in written language. Understanding these patterns helps readers decode unfamiliar words by recognizing common letter combinations and their associated sounds.',
      },
      {
        header: 'WHY IS PHONICS IMPORTANT?',
        desc: 'Phonics is a fundamental skill for reading development. It helps students connect written letters to spoken sounds, enabling them to decode new words independently. Strong phonics skills contribute to better reading fluency and comprehension.',
      },
    ],
  },
  swr: {
    color: '#E97A49',
    header: 'ROAR-WORD',
    subheader: 'Single Word Recognition',
    desc: `ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read fluently, students must master fundamental skills of decoding and automaticity. This test measures a student's ability to detect real and made-up words, which can then translate to a student's reading levels and need for support. The student's score will range between ${
      getRawScoreRange('swr').min
    }-${
      getRawScoreRange('swr').max
    } and can be viewed by selecting 'Raw Score' on the table above. Students in the pink category need support in word-level decoding. For these students, decoding difficulties are likely the bottleneck for growth in reading fluency and comprehension. Students in grades K-5 in the pink category have word-level decoding skills below {{SUPPORT_RANGE}} of their peers, nationally. Students in grades 6-12 in the pink category have word-level decoding skills below a third-grade level. Students in the yellow category are still developing their decoding skills and will likely benefit from further practice and/or support in foundational reading skills. Students in the green category demonstrate that word-level decoding is not holding them back from developing fluency and comprehension of connected text.`,
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
      'difficulties with decoding words accurately or reading slowly and with effort.' +
      ` The student's score will range between ${getRawScoreRange('sre').min}-${getRawScoreRange('sre').max} ` +
      "and can be viewed by selecting 'Raw Score' on the table above. " +
      'Students in the pink category need support in sentence-reading ' +
      'efficiency to support growth in reading comprehension. Students in grades ' +
      'K-5 in the pink category have sentence-reading efficiency skills below {{SUPPORT_RANGE}} ' +
      'of their peers. Students in grades 6-12 in the pink category have ' +
      'sentence-reading efficiency skills below a third-grade level. ' +
      'Students in the yellow category are still developing their sentence' +
      '-reading efficiency skills and will benefit from focused reading ' +
      'practice. Students in the green category demonstrate that ' +
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
  'letter-en-ca': {
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
  'roar-readaloud': {
    color: '#E19834',
    header: 'ROAR-ReadAloud',
    subheader: 'ReadAloud',
    desc: 'ROAR-ReadAloud',
  },
  'fluency-arf': {
    header: 'ROAM Math Facts',
    color: '#52627E',
    subheader: 'Math Facts - Response Modality Experiment',
    desc:
      'Math fluency is a foundational math skill that is measured by testing ' +
      'how quickly and accurately students solve simple arithmetic problems. ROAM Math ' +
      'Facts measures memory-based fact retrieval (e.g., 3x4), one of the two key processes ' +
      'required for proficient math fluency. In online assessment, the response speed can ' +
      'be affected by a student’s familiarity with the digital mode. This can have implications ' +
      'on the precision and validity of the assessment. In order to evaluate this in ROAM, we ' +
      'are running an experiment on two response modality designs, employing free response ' +
      'and multiple choice, respectively. The goal of this experiment is to identify the ' +
      'response modality that best captures math fluency, while minimizing the impact of ' +
      'digital familiarity on the assessment. Students experience these response modes as ' +
      'two 3-minute blocks, each scored separately. Each block begins with addition and ' +
      'subtraction, then progresses to multiplication and division.',
  },
  'fluency-calf': {
    header: 'ROAM Calculation Fluency',
    color: '#52627E',
    subheader: 'Calculation Fluency - Response Modality Experiment',
    desc:
      'Math fluency is a foundational math skill that is measured by testing ' +
      'how quickly and accurately students solve simple arithmetic problems. ROAM ' +
      'Calculation Fluency measures mental calculation performance (e.g., 37x4), one ' +
      'of the two key processes required for proficient math fluency. In online assessment, ' +
      'the response speed can be affected by a student’s familiarity with the digital mode. ' +
      'This can have implications on the precision and validity of the assessment. In order to ' +
      'evaluate this in ROAM, we are running an experiment on two response modality designs, ' +
      'employing free response and multiple choice, respectively. The goal of this experiment ' +
      'is to identify the response modality that best captures math fluency, while minimizing ' +
      'the impact of digital familiarity on the assessment. Students experience these response ' +
      'modes as two 4.5-minute blocks, each scored separately. Each block begins with addition ' +
      'and subtraction, then progresses to multiplication and division.',
  },
  'roam-alpaca': {
    header: 'ROAM Core Math',
    color: '#52627E',
    subheader: 'Core Math Procedures',
    desc:
      'ROAM-Core Math quickly measures students’ command of a wide range of key math skills, ' +
      'including basic arithmetic, fractions and decimals, algebraic equations, and more. ' +
      'Questions become more advanced as the student progresses through the assessment, ' +
      'which ends once the student reaches a ceiling in their procedural knowledge. ' +
      'This assessment provides educators with information about students’ knowledge of ' +
      'specific math skills, proficiency in key math categories, and overall estimated ' +
      'grade level based on their performance. These insights can be used to gauge both ' +
      'student-level and classroom-wide competencies so that instruction can be customized ' +
      'appropriately.',
  },
};

// Then create a function to populate the template
export const replaceScoreRange = (desc, taskId, scoringVersion = null) => {
  if (!desc) return '';

  // Only process desc field if it contains placeholders
  if (desc.includes('{{RANGE}}')) {
    const range = getRawScoreRange(taskId, scoringVersion);
    return desc.replace('{{RANGE}}', `${range?.min}-${range?.max}`);
  }

  if (desc.includes('{{SUPPORT_RANGE}}')) {
    const useUpdatedNorms = (taskId === 'sre' && scoringVersion >= 4) || (taskId === 'swr' && scoringVersion >= 7);
    return desc.replace('{{SUPPORT_RANGE}}', `${useUpdatedNorms ? '80' : '75'}%`);
  }

  return desc;
};
