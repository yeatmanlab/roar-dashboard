import type { CatInput } from '@bdelab/jscat';
// @ts-ignore
export type { ValidityEvaluator } from '@bdelab/roar-utils';
export interface IrtHyperparamsRow {
  trial_type?: string;
  'theta.min': number;
  'theta.max': number;
  'theta.mean': number;
  'theta.sd': number;
  'transformation.scale': number;
  'transformation.shift': number;
}
export interface IrtHyperparams {
  minTheta: number;
  maxTheta: number;
  priorPar: number[];
  transformationScale: number;
  transformationShift: number;
}

export type ClowderInputMap = {
  [taskName: string]: {
    [version: number]: CatInput;
  };
};

export interface ClowderSelectionConfigItem {
  catsToUpdate: string[];
  catToSelect: string;
  catOrderMap: Record<number, string>;
}

export interface ClowderSelectionConfigMap {
  [taskName: string]: {
    [version: number]: ClowderSelectionConfigItem;
  };
}

type ClowderLogicalOperation = 'and' | 'or' | 'only' | 'AND' | 'OR' | 'ONLY' | undefined;

export interface ClowderEarlyStoppingRulesMap {
  [taskName: string]: {
    [version: number]: {
      requiredItems: {
        [cat: string]: number;
      };
      logicalOperation: ClowderLogicalOperation;
    };
  };
}

export interface ClowderIrtHyperparamsMap {
  [taskName: string]: {
    [version: number]: {
      csvUrl: string;
      catsScaled: string[];
    };
  };
}

export interface ClowderCorpusParamsMap {
  [taskName: string]: {
    [version: number]: {
      corpus: string;
      catNames: string[];
      delimiter: string;
    };
  };
}

export interface ClowderZetaItem {
  cats: string[];
  zeta: Record<'a' | 'b' | 'c' | 'd', number>;
}

export interface ClowderThetaEstimates {
  thetaEstimate: number;
  thetaSE: number;
}

// Condition function argument is handled internally by baseEvaluateValidity. See @bdelab/roar-utils
// data: { responseTimes, responses, correct, completed } (baseEvaluateValidity params)
// & { existingFlags } (flags appended already)
// Pre-defined flags: 'notEnoughResponses', 'responseTimeTooSlow', 'responseTimeTooFast', 'accuracyTooLow', 'incomplete'
// To define a single custom condition, omit the logicalOperation field.
interface CustomValidation {
  logicalOperation?: 'and' | 'or' | 'xor';
  conditions: ((data: any) => boolean)[];
  flag: string;
}

export interface TaskReliabilityConfig {
  responseTimeLowThreshold?: number;
  responseTimeHighThreshold?: number;
  accuracyThreshold?: number;
  minResponsesRequired?: number;
  includedReliabilityFlags?: string[];
  customValidations?: CustomValidation[];
}

export interface TaskReliabilityConfigMap {
  [taskName: string]: {
    [version: number]: TaskReliabilityConfig;
  };
}
