import html2canvas from 'html2canvas';
import { getGrade } from '@bdelab/roar-utils';

interface TaskDisplayName {
  name: string;
  publicName: string;
  studentFacingName: string;
  extendedTitle: string;
  extendedName: string;
  order: number;
}

interface TaskDisplayNames {
  [key: string]: TaskDisplayName;
}

interface ExtendedDescriptions {
  [key: string]: string;
}

interface SupportLevel {
  level: string;
  description: string;
  color: string;
}

interface ScoreKey {
  key: string;
  label: string;
  description: string;
}

interface RawScoreRange {
  min: number;
  max: number;
}

/*
 *  Task Display Names
 *  A map of all tasks, including their taskId, display name, and index for ordering
 *  Key: taskId
 *  Value: { orderindex, displayName }
 */

export const taskDisplayNames: TaskDisplayNames = {
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
    order: 6,
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
    order: 8,
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
    publicName: 'ROAM - Math Facts Fluency',
    studentFacingName: 'Math Facts Fluency',
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
  phonics: {
    name: 'Phonics',
    publicName: 'ROAR - Phonics',
    studentFacingName: 'Phonics',
    extendedTitle: 'ROAR - Phonics',
    extendedName: 'Phonics',
    order: 18,
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
    studentFacingName: 'Crowding',
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
};

export const extendedDescriptions: ExtendedDescriptions = {
  swr: "This test measures your student's skill in reading single words quickly and correctly.",
  'swr-es':
    'This test measures how well a student can identify real words and made-up words. ' +
    'The goal is for students to recognize words quickly and accurately, a skill called decoding. ' +
    'High scores on this assessment indicate a readiness to be a skilled and fluent reader.',
};

const pageWidth = 595.28; // A4 width in points

const returnScaleFactor = (width: number): number => pageWidth / width;

export const addElementToPdf = async (
  element: HTMLElement,
  document: any,
  yCounter: number,
  offset = 0
): Promise<number> => {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const scaleFactor = returnScaleFactor(imgWidth);
  const scaledHeight = imgHeight * scaleFactor;

  const img = new Image();
  img.src = imgData;

  await new Promise((resolve) => {
    img.onload = resolve;
  });

  document.addImage(imgData, 'PNG', 0, yCounter + offset, pageWidth, scaledHeight);

  return yCounter + scaledHeight + offset;
};

export const getSupportLevel = (
  grade: number,
  percentile: number,
  rawScore: number,
  taskId: string,
  optional: any = null
): SupportLevel => {
  const gradeLevel = getGrade(grade);
  const task = taskDisplayNames[taskId];

  if (!task) {
    return {
      level: 'Unknown',
      description: 'Task not found',
      color: '#000000',
    };
  }

  if (percentile >= 75) {
    return {
      level: 'Advanced',
      description: 'Student is performing at an advanced level',
      color: '#4CAF50',
    };
  } else if (percentile >= 50) {
    return {
      level: 'Proficient',
      description: 'Student is performing at a proficient level',
      color: '#2196F3',
    };
  } else if (percentile >= 25) {
    return {
      level: 'Basic',
      description: 'Student is performing at a basic level',
      color: '#FFC107',
    };
  } else {
    return {
      level: 'Below Basic',
      description: 'Student is performing below basic level',
      color: '#F44336',
    };
  }
};

export function getScoreKeys(taskId: string, grade: number): ScoreKey[] {
  const task = taskDisplayNames[taskId];

  if (!task) {
    return [];
  }

  const baseKeys: ScoreKey[] = [
    {
      key: 'rawScore',
      label: 'Raw Score',
      description: 'The number of items answered correctly',
    },
    {
      key: 'percentile',
      label: 'Percentile',
      description: 'The percentage of students who scored lower than this student',
    },
  ];

  if (task.order <= 12) {
    baseKeys.push({
      key: 'standardScore',
      label: 'Standard Score',
      description: 'A standardized score with a mean of 100 and standard deviation of 15',
    });
  }

  return baseKeys;
}

export const getRawScoreThreshold = (taskId: string): number => {
  const task = taskDisplayNames[taskId];

  if (!task) {
    return 0;
  }

  // Add your threshold logic here
  return 0;
};

export const getRawScoreRange = (taskId: string): RawScoreRange => {
  const task = taskDisplayNames[taskId];

  if (!task) {
    return { min: 0, max: 0 };
  }

  // Add your range logic here
  return { min: 0, max: 0 };
};

/**
 * Tasks that should display percent correct in the score report.
 */
export const tasksToDisplayPercentCorrect = [
  'vocab',
  'roarInference',
  'matrixReasoning',
  'mentalRotation',
  'sameDifferentSelection',
  'theoryOfMind',
  'trog',
  'mefs',
];

/**
 * Tasks that should display correct/incorrect difference in the score report.
 */
export const tasksToDisplayCorrectIncorrectDifference = [
  'heartsAndFlowers',
  'egmaMath',
  'memoryGame',
];

/**
 * Tasks that should display total correct in the score report.
 */
export const tasksToDisplayTotalCorrect = [
  'heartsAndFlowers',
  'egmaMath',
  'memoryGame',
];

/**
 * Tasks that should only display raw scores in the score report.
 */
export const rawOnlyTasks = [
  'heartsAndFlowers',
  'egmaMath',
  'memoryGame',
];

/**
 * Tasks that have scored results in the score report.
 */
export const scoredTasks = [
  'vocab',
  'roarInference',
  'matrixReasoning',
  'mentalRotation',
  'sameDifferentSelection',
  'theoryOfMind',
  'trog',
  'mefs',
];

/**
 * Flags that should be included in the score report for each task.
 */
export const includedValidityFlags: Record<string, string[]> = {
  vocab: ['accuracyTooLow', 'notEnoughResponses', 'responseTimeTooFast'],
  roarInference: ['accuracyTooLow', 'notEnoughResponses', 'responseTimeTooFast'],
  matrixReasoning: ['accuracyTooLow', 'notEnoughResponses', 'responseTimeTooFast'],
  mentalRotation: ['accuracyTooLow', 'notEnoughResponses', 'responseTimeTooFast'],
  sameDifferentSelection: ['accuracyTooLow', 'notEnoughResponses', 'responseTimeTooFast'],
  theoryOfMind: ['accuracyTooLow', 'notEnoughResponses', 'responseTimeTooFast'],
  trog: ['accuracyTooLow', 'notEnoughResponses', 'responseTimeTooFast'],
  mefs: ['accuracyTooLow', 'notEnoughResponses', 'responseTimeTooFast'],
}; 