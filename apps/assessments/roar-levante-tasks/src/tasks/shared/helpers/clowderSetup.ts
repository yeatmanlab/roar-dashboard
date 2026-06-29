import Papa from 'papaparse';
import _clamp from 'lodash/clamp';
import type {
  IrtHyperparamsRow,
  IrtHyperparams,
  ClowderInputMap,
  ClowderSelectionConfigMap,
  ClowderEarlyStoppingRulesMap,
  ClowderIrtHyperparamsMap,
  ClowderCorpusParamsMap,
  ClowderThetaEstimates,
} from '../types/catTypes';

/**
 * Configuration for Clowder CAT (Computerized Adaptive Testing) initialization.
 * Defines item selection methods, starting parameters, and ability estimation methods per task and version.
 */
export const CLOWDER_CONFIG: ClowderInputMap = {
  trog: {
    1: {
      startSelect: 'random',
      nStartItems: 10,
      priorDist: 'norm',
      itemSelect: 'mfi',
      method: 'eap',
    },
  },
  'roar-inference': {
    1: {
      startSelect: 'random',
      nStartItems: 3,
      itemSelect: 'mfi',
      method: 'eap',
    },
  },
};

/**
 * Configuration for CAT selection logic.
 * Specifies which CAT categories to update, which to select from, and the order of CAT blocks.
 */
export const CLOWDER_SELECTION_CONFIG: ClowderSelectionConfigMap = {
  trog: {
    1: {
      catsToUpdate: ['composite', 'new', 'composite_comprehension'],
      catToSelect: 'composite',
      catOrderMap: {
        0: 'practice',
        1: 'composite',
        2: 'new',
      },
    },
  },
  'roar-inference': {
    1: {
      catsToUpdate: ['composite', 'composite_comprehension'],
      catToSelect: 'composite',
      catOrderMap: {
        0: 'composite',
      },
    },
  },
};

/**
 * Early stopping rules for CAT administration.
 * Defines minimum required items per category and logical operations for termination.
 */
export const CLOWDER_EARLY_STOPPING_RULES: ClowderEarlyStoppingRulesMap = {
  trog: {
    1: {
      requiredItems: {
        composite: 25,
        new: 5,
      },
      logicalOperation: 'and',
    },
  },
  'roar-inference': {
    1: {
      requiredItems: {
        composite: 25,
      },
      logicalOperation: 'and',
    },
  },
};

/**
 * IRT (Item Response Theory) hyperparameter configuration.
 * Contains CSV URLs for hyperparameters and lists of CAT categories that use scaled scores.
 *
 * Assume same hyperparameters for all scoring versions until further notice
 */
export const CLOWDER_IRT_HYPERPARAMS: ClowderIrtHyperparamsMap = {
  trog: {
    1: {
      csvUrl: 'https://storage.googleapis.com/roar-syntax/scores/trog_hyperparameters_v1.csv',
      catsScaled: ['composite', 'composite_comprehension'],
    },
  },
  'roar-inference': {
    1: {
      csvUrl: 'https://storage.googleapis.com/roar-inference/scores/inference_hyperparameters_v1.csv',
      catsScaled: ['composite', 'composite_comprehension'],
    },
  },
};

/**
 * Corpus parameters for CAT item banks.
 * Specifies corpus file names, CAT category names, and delimiters for parsing.
 */
export const CLOWDER_CORPUS_PARAMS: ClowderCorpusParamsMap = {
  trog: {
    1: {
      corpus: 'roar-syntax-item-2026-05-14-v3.csv',
      catNames: ['practice', 'composite', 'new', 'composite_comprehension'],
      delimiter: '.',
    },
  },
  'roar-inference': {
    1: {
      corpus: 'inference-2026-05-14-v3.csv',
      catNames: ['composite', 'composite_comprehension'],
      delimiter: '.',
    },
  },
};

/**
 * Parses IRT hyperparameters from CSV row format into structured configuration.
 * Handles both single and multiple hyperparameter sets (distinguished by trial_type).
 *
 * @param hyperparams - Array of hyperparameter rows from CSV
 * @returns Object mapping trial types to their IRT hyperparameters
 * @throws Error if multiple rows exist without trial_type column
 */
export const parseIrtHyperparams = (hyperparams: IrtHyperparamsRow[]): { [key: string]: IrtHyperparams } => {
  if (hyperparams.length > 1 && !hyperparams[0].trial_type) {
    throw new Error('Multiple hyperparameter rows found but no trial_type column found');
  }

  return hyperparams.reduce(
    (acc, row) => {
      // Assessments with only one set of hyperparameters may not define a trial_type column
      const key = row.trial_type ? row.trial_type.toLowerCase() : 'composite';
      acc[key] = {
        minTheta: Number(row['theta.min']),
        maxTheta: Number(row['theta.max']),
        priorPar: [Number(row['theta.mean']), Number(row['theta.sd'])],
        transformationScale: Number(row['transformation.scale']),
        transformationShift: Number(row['transformation.shift']),
      };
      return acc;
    },
    {} as { [key: string]: IrtHyperparams },
  );
};

/**
 * Clamps a positive standard error value to a valid range and guards against NaN.
 * Returns Number.MIN_VALUE if the input is NaN, zero, or negative.
 *
 * @param thetaSE - Standard error value (expected to be positive)
 * @returns Clamped value in range [Number.MIN_VALUE, Number.MAX_VALUE]
 */
export const clampPositive = (thetaSE: number): number => {
  if (isNaN(thetaSE) || thetaSE <= 0) {
    return Number.MIN_VALUE;
  }
  return _clamp(thetaSE, Number.MIN_VALUE, Number.MAX_VALUE);
};

/**
 * Creates a function to scale raw theta estimates using IRT hyperparameters.
 * Applies linear transformation (scale and shift) to both theta and standard error.
 *
 * @param hyperparams - IRT hyperparameters mapping by category
 * @returns Function that transforms raw theta values to scaled estimates
 */
export const createScaleTheta = (hyperparams: {
  [key: string]: IrtHyperparams;
}): ((thetaRaw: number, thetaSERaw: number, cat?: string) => ClowderThetaEstimates) => {
  return (thetaRaw: number, thetaSERaw: number, cat?: string): ClowderThetaEstimates => {
    let catKey = !hyperparams[cat as string] ? 'composite' : cat;
    const { transformationScale, transformationShift } = hyperparams[catKey as string];
    const thetaScaled = thetaRaw * transformationScale + transformationShift;
    const thetaSEScaled = thetaSERaw * Math.abs(transformationScale);
    return { thetaEstimate: thetaScaled, thetaSE: clampPositive(thetaSEScaled) };
  };
};

/**
 * Fetches and parses IRT hyperparameters from a remote CSV file.
 *
 * @param url - URL to the hyperparameters CSV file
 * @returns Promise resolving to parsed hyperparameters object
 */
export const getIrtHyperparameters = (url: string): Promise<{ [key: string]: IrtHyperparams }> => {
  return new Promise((resolve, reject) => {
    Papa.parse<IrtHyperparamsRow>(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: function (results) {
        resolve(parseIrtHyperparams(results.data as IrtHyperparamsRow[]));
      },
      error: function (error) {
        reject(error);
      },
    });
  });
};
