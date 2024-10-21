import { playSWR } from '../../support/helper-functions/roar-swr/swrHelpers.js';
import { playSRE } from '../../support/helper-functions/roar-sre/sreHelpers.js';
import { playLetter } from '../../support/helper-functions/roar-letter/letterHelpers.js';
import { playPA } from '../../support/helper-functions/roar-pa/paHelpers.js';
import { playARF, playCALF } from '../../support/helper-functions/roam-apps/roamHelpers';
import {
  playMorphology,
  playWrittenVocabulary,
} from '../../support/helper-functions/roar-multichoice/multichoiceHelpers.js';
import { playVocabulary } from '../../support/helper-functions/roar-vocab/vocabHelpers.js';

export const testSpecs = [
  {
    name: 'ROAR - Picture Vocabulary',
    app: '@bdelab/roar-vocab',
    spec: playVocabulary,
    language: 'en',
  },
  {
    name: 'ROAR - Written Vocabulary',
    app: '@bdelab/roar-multichoice',
    spec: playWrittenVocabulary,
    language: 'en',
  },
  {
    name: 'ROAR - Letter',
    app: '@bdelab/roar-letter',
    spec: playLetter,
    language: 'en',
  },
  {
    name: 'ROAR - Letra',
    app: '@bdelab/roar-letter',
    spec: playLetter,
    language: 'es',
  },
  {
    name: 'ROAR - Morphology',
    app: '@bdelab/roar-multichoice',
    spec: playMorphology,
    language: 'en',
  },
  {
    name: 'ROAR - Phoneme',
    app: '@bdelab/roar-pa',
    spec: playPA,
    language: 'en',
  },
  {
    name: 'ROAR - Fonema',
    app: '@bdelab/roar-pa',
    spec: playPA,
    language: 'es',
  },
  {
    name: 'ROAR - Sentence',
    app: '@bdelab/roar-sre',
    spec: playSRE,
    language: 'en',
  },
  {
    name: 'ROAR - Frase',
    app: '@bdelab/roar-sre',
    spec: playSRE,
    language: 'es',
  },
  {
    name: 'ROAR - Word',
    app: '@bdelab/roar-swr',
    spec: playSWR,
    language: 'en',
  },
  {
    name: 'ROAR - Palabra',
    app: '@bdelab/roar-swr',
    spec: playSWR,
    language: 'es',
  },
  {
    name: 'ROAM - Single Digit',
    app: '@bdelab/roam-fluency',
    spec: playARF,
    language: 'en',
  },
  {
    name: 'ROAM - Un Dígito',
    app: '@bdelab/roam-fluency',
    spec: playARF,
    language: 'es',
  },
  {
    name: 'ROAM - Multi Digit',
    app: '@bdelab/roam-fluency',
    spec: playCALF,
    language: 'en',
  },
  {
    name: 'ROAM - Varios Dígitos',
    app: '@bdelab/roam-fluency',
    spec: playCALF,
    language: 'es',
  },
];
