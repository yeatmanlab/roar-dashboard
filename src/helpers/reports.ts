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

/**
 * Colors for different support levels in the score report.
 */
export const supportLevelColors: Record<string, string> = {
  Advanced: '#4CAF50',
  Proficient: '#2196F3',
  Basic: '#FFC107',
  'Below Basic': '#F44336',
};

/**
 * Tags for different progress levels in the score report.
 */
export const progressTags: Record<string, { color: string; severity: string }> = {
  'Significant Progress': { color: '#4CAF50', severity: 'success' },
  'Moderate Progress': { color: '#2196F3', severity: 'info' },
  'Limited Progress': { color: '#FFC107', severity: 'warning' },
  'No Progress': { color: '#F44336', severity: 'danger' },
};

/**
 * Grade options for filtering in the progress report.
 */
export const gradeOptions = [
  { label: 'Pre-K', value: -1 },
  { label: 'Kindergarten', value: 0 },
  { label: '1st Grade', value: 1 },
  { label: '2nd Grade', value: 2 },
  { label: '3rd Grade', value: 3 },
  { label: '4th Grade', value: 4 },
  { label: '5th Grade', value: 5 },
  { label: '6th Grade', value: 6 },
  { label: '7th Grade', value: 7 },
  { label: '8th Grade', value: 8 },
  { label: '9th Grade', value: 9 },
  { label: '10th Grade', value: 10 },
  { label: '11th Grade', value: 11 },
  { label: '12th Grade', value: 12 },
];

/**
 * Task information by task ID.
 */
export const taskInfoById: Record<string, { name: string; description: string }> = {
  letter: {
    name: 'Letter Names and Sounds',
    description: 'Measures knowledge of letter names and sounds',
  },
  'letter-es': {
    name: 'Nombres y Sonidos de Letras',
    description: 'Mide el conocimiento de los nombres y sonidos de las letras',
  },
  pa: {
    name: 'Phonological Awareness',
    description: 'Measures ability to identify and manipulate sounds in spoken language',
  },
  'pa-es': {
    name: 'Conciencia Fonológica',
    description: 'Mide la capacidad de identificar y manipular sonidos en el lenguaje hablado',
  },
  swr: {
    name: 'Single Word Recognition',
    description: 'Measures ability to read individual words accurately',
  },
  'swr-es': {
    name: 'Reconocimiento de Palabras',
    description: 'Mide la capacidad de leer palabras individuales con precisión',
  },
  sre: {
    name: 'Sentence Reading Efficiency',
    description: 'Measures ability to read sentences quickly and accurately',
  },
  'sre-es': {
    name: 'Eficiencia en la Lectura de Frases',
    description: 'Mide la capacidad de leer frases rápida y precisamente',
  },
  morphology: {
    name: 'Morphological Awareness',
    description: 'Measures understanding of word structure and formation',
  },
  cva: {
    name: 'Written Vocabulary',
    description: 'Measures written vocabulary knowledge',
  },
  multichoice: {
    name: 'Multiple Choice Vocabulary',
    description: 'Measures vocabulary through multiple choice questions',
  },
  vocab: {
    name: 'Picture Vocabulary',
    description: 'Measures vocabulary through picture recognition',
  },
  fluency: {
    name: 'Math Fluency',
    description: 'Measures speed and accuracy in basic math operations',
  },
  'fluency-arf': {
    name: 'Single Digit Math Facts',
    description: 'Measures fluency with single-digit arithmetic',
  },
  'fluency-arf-es': {
    name: 'Operaciones de Un Dígito',
    description: 'Mide la fluidez con aritmética de un dígito',
  },
  'fluency-calf': {
    name: 'Multi-Digit Calculation',
    description: 'Measures fluency with multi-digit arithmetic',
  },
  'fluency-calf-es': {
    name: 'Cálculos de Varios Dígitos',
    description: 'Mide la fluidez con aritmética de varios dígitos',
  },
  syntax: {
    name: 'Syntax',
    description: 'Measures understanding of sentence structure',
  },
  trog: {
    name: 'Syntax',
    description: 'Measures understanding of grammatical structures',
  },
  roarInference: {
    name: 'Inference',
    description: 'Measures ability to make inferences from text',
  },
  phonics: {
    name: 'Phonics',
    description: 'Measures understanding of letter-sound relationships',
  },
  comp: {
    name: 'Reading Comprehension',
    description: 'Measures understanding of written text',
  },
  mep: {
    name: 'Multi-Element Processing',
    description: 'Measures ability to process multiple visual elements',
  },
  'mep-pseudo': {
    name: 'MEP with Pseudo-Words',
    description: 'Measures processing of multiple elements using non-words',
  },
  ExternalTask: {
    name: 'External Task',
    description: 'External assessment task',
  },
  ran: {
    name: 'Rapid Automatized Naming',
    description: 'Measures speed of naming familiar objects',
  },
  crowding: {
    name: 'Visual Crowding',
    description: 'Measures visual processing in crowded displays',
  },
  'roav-mep': {
    name: 'Visual Multi-Element Processing',
    description: 'Measures processing of multiple visual elements',
  },
  ExternalTest: {
    name: 'External Test',
    description: 'External assessment test',
  },
};

/**
 * Task descriptions by task ID.
 */
export const descriptionsByTaskId: Record<string, string> = {
  letter: 'Measures knowledge of letter names and sounds',
  'letter-es': 'Mide el conocimiento de los nombres y sonidos de las letras',
  pa: 'Measures ability to identify and manipulate sounds in spoken language',
  'pa-es': 'Mide la capacidad de identificar y manipular sonidos en el lenguaje hablado',
  swr: 'Measures ability to read individual words accurately',
  'swr-es': 'Mide la capacidad de leer palabras individuales con precisión',
  sre: 'Measures ability to read sentences quickly and accurately',
  'sre-es': 'Mide la capacidad de leer frases rápida y precisamente',
  morphology: 'Measures understanding of word structure and formation',
  cva: 'Measures written vocabulary knowledge',
  multichoice: 'Measures vocabulary through multiple choice questions',
  vocab: 'Measures vocabulary through picture recognition',
  fluency: 'Measures speed and accuracy in basic math operations',
  'fluency-arf': 'Measures fluency with single-digit arithmetic',
  'fluency-arf-es': 'Mide la fluidez con aritmética de un dígito',
  'fluency-calf': 'Measures fluency with multi-digit arithmetic',
  'fluency-calf-es': 'Mide la fluidez con aritmética de varios dígitos',
  syntax: 'Measures understanding of sentence structure',
  trog: 'Measures understanding of grammatical structures',
  roarInference: 'Measures ability to make inferences from text',
  phonics: 'Measures understanding of letter-sound relationships',
  comp: 'Measures understanding of written text',
  mep: 'Measures ability to process multiple visual elements',
  'mep-pseudo': 'Measures processing of multiple elements using non-words',
  ExternalTask: 'External assessment task',
  ran: 'Measures speed of naming familiar objects',
  crowding: 'Measures visual processing in crowded displays',
  'roav-mep': 'Measures processing of multiple visual elements',
  ExternalTest: 'External assessment test',
};

/**
 * Tasks that should display graphs in the score report.
 */
export const tasksToDisplayGraphs = [
  'letter',
  'letter-es',
  'pa',
  'pa-es',
  'swr',
  'swr-es',
  'sre',
  'sre-es',
  'morphology',
  'cva',
  'multichoice',
  'vocab',
  'fluency',
  'fluency-arf',
  'fluency-arf-es',
  'fluency-calf',
  'fluency-calf-es',
  'syntax',
  'trog',
  'roarInference',
  'phonics',
  'comp',
  'mep',
  'mep-pseudo',
  'ran',
  'crowding',
  'roav-mep',
]; 