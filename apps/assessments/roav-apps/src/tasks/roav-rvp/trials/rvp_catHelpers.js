import { Cat } from '@bdelab/jscat';
import { sessionGet } from '../../shared/helpers/sessionHelpers';
import { RVP_SESSION_KEYS as SK } from '../helpers/rvp_sessionKeys';
import { wrapAsJsPsychTrial } from '../../shared/helpers/jspsychHelpers';

export const MethodCat = {
  MLE: 'MLE',
};

export const ItemSelectCat = {
  MFI: 'MFI',
};

export const THETA_MAX_DEF = 6;

export const TYPE_CAT_COMB = 'comb';

export const SCORE_ROAR_MIN = 100;
export const SCORE_ROAR_MAX = 900;

export const paramsCatDef = {
  method: MethodCat.MLE,
  itemSelect: ItemSelectCat.MFI,
  nStartItems: 0,
  theta: 0,
  minTheta: -THETA_MAX_DEF,
  maxTheta: THETA_MAX_DEF,
};

export const createCat = (paramsIn) => {
  const params = { ...paramsCatDef, ...paramsIn };
  const cat = new Cat(params);
  return cat;
};

// ===================================================

export const catsAll = {
  cats: {},
  arrParamsRasch: {},
  arrTransf: {},
  arrsHyperparams: {},
  catComb: null,
  transfComb: null,
  hyperparamsComb: null,
};

// typeCat is something like "opto" or "pseudo", not combined
export const calcDifficultyMean = (typeCat, numStim) => {
  let difficultyMean = 0;
  for (let iPos = 0; iPos < numStim; iPos += 1) {
    difficultyMean += catsAll.arrParamsRasch[typeCat][numStim][iPos].b;
  }
  difficultyMean /= numStim;
  return difficultyMean;
};

export const calcThetaFromProb = (p, a, b, c, d) => b - Math.log((d - p) / (p - c)) / a;

// typeCat is something like "opto" or "pseudo", not combined
// assuming a, c, d are the same for all items in a block
export const calcThetaFromProbDifficultyMean = (p, typeCat, numStim) => {
  const { a, c, d } = catsAll.arrParamsRasch[typeCat][numStim][0];
  const bMean = calcDifficultyMean(typeCat, numStim);
  return calcThetaFromProb(p, a, bMean, c, d);
};

// IMPORTANT: correct parameter is TRUE / FALSE (not 1 / 0)
export const updateAbilityEstimate = (typeCat, numStim, posTarg, correct) => {
  const catCur = catsAll.cats[typeCat];
  const paramsRaschCur = catsAll.arrParamsRasch[typeCat];
  const theta = paramsRaschCur[numStim][posTarg];
  catCur.updateAbilityEstimate([theta], correct ? 1 : 0);
};

// IMPORTANT: here typeCat is "pseudo" or "opto" (but not TYPE_CAT_COMB)
// IMPORTANT: correct parameter is TRUE / FALSE (not 1 / 0)
export const updateAbilityEstimateComb = (typeCat, numStim, posTarg, correct) => {
  const paramsRasch = catsAll.arrParamsRasch[typeCat];
  const theta = paramsRasch[numStim][posTarg];
  catsAll.catComb.updateAbilityEstimate([theta], correct ? 1 : 0);
};

// combined does not have theta!
export const getParamsItem = (typeCat, numStim, posTarg) => {
  if (typeCat === TYPE_CAT_COMB) {
    return null;
  }
  const paramsRaschCur = catsAll.arrParamsRasch[typeCat];
  const paramsItem = paramsRaschCur[numStim][posTarg];
  return paramsItem;
};

export const getCat = (typeCat) => {
  if (typeCat === TYPE_CAT_COMB) {
    return catsAll.catComb;
  }
  return catsAll.cats[typeCat];
};

export const getTransf = (typeCat) => {
  if (typeCat === TYPE_CAT_COMB) {
    return catsAll.transfComb;
  }
  return catsAll.arrTransf[typeCat];
};

export const getHyperparams = (typeCat) => {
  if (typeCat === TYPE_CAT_COMB) {
    return catsAll.hyperparamsComb;
  }
  return catsAll.arrsHyperparams[typeCat];
};

export const calcThetaRaw = (typeCat) => {
  const cat = getCat(typeCat);
  return cat.theta;
};

export const calcThetaTransf = (typeCat) => {
  const cat = getCat(typeCat);
  const transf = getTransf(typeCat);
  const thetaTransf = cat.theta * transf.scale + transf.shift;
  return thetaTransf;
};

export const calcThetaSE = (typeCat) => {
  const cat = getCat(typeCat);
  const thetaSeCur = cat.seMeasurement === Infinity ? Number.MAX_VALUE : cat.seMeasurement;
  return thetaSeCur;
};

export const calcRoarScore = (typeCat) => {
  const thetaTransf = calcThetaTransf(typeCat);
  let score =
    SCORE_ROAR_MIN + ((SCORE_ROAR_MAX - SCORE_ROAR_MIN) * (thetaTransf + THETA_MAX_DEF)) / (2 * THETA_MAX_DEF);
  score = Math.max(score, SCORE_ROAR_MIN);
  score = Math.min(score, SCORE_ROAR_MAX);
  return score;
};

export const calcDataCat = (typeCat) => ({
  typeCat,
  thetaRaw: calcThetaRaw(typeCat),
  thetaTransf: calcThetaTransf(typeCat),
  thetaSE: calcThetaSE(typeCat),
  roarScore: calcRoarScore(typeCat),
});

export const calcDataCatFormat = (typeCat) => ({
  typeCat,
  thetaEstimateRaw: calcThetaRaw(typeCat),
  thetaEstimate: calcThetaTransf(typeCat),
  thetaSE: calcThetaSE(typeCat),
  roarScore: calcRoarScore(typeCat),
});

export const rvp_initCatsAll = () => {
  const configsStim = sessionGet(SK.CONFIGS_STIM);

  catsAll.cats = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const [type, config] of Object.entries(configsStim)) {
    catsAll.cats[type] = createCat({
      minTheta: config.hyperparams.theta_min,
      maxTheta: config.hyperparams.theta_max,
    });
    catsAll.arrParamsRasch[type] = config.paramsRasch;
    catsAll.arrTransf[type] = {
      scale: config.hyperparams.transformation_scale,
      shift: config.hyperparams.transformation_shift,
    };
    catsAll.arrsHyperparams[type] = {
      thetaMin: config.hyperparams.theta_min,
      thetaMax: config.hyperparams.theta_max,
    };
  }
  catsAll.catComb = createCat();
  // IMPORTANT transfComb assumes that transformations are the same for both types!
  const typeFirst = Object.keys(configsStim)[0];
  catsAll.transfComb = catsAll.arrTransf[typeFirst];
  catsAll.hyperparamsComb = {
    thetaMin: -THETA_MAX_DEF,
    thetaMax: THETA_MAX_DEF,
  };
};

export const t_initCatsAll = () => wrapAsJsPsychTrial(rvp_initCatsAll);
