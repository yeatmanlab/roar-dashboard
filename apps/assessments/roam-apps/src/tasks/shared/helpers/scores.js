import _mapValues from 'lodash/mapValues';
import _reduce from 'lodash/reduce';
import _omit from 'lodash/omit';
import store from 'store2';
import _round from 'lodash/round';
import { AssessmentStage, COMPOSITE_DOMAIN } from '@roar-platform/assessment-schema';
import {
  ROAM_FLUENCY_SUBTASK_DOMAINS,
  ROAM_ALPACA_SUBTASK_DOMAINS,
  ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS,
  ROAM_FLUENCY_ARF_TASK_IDS,
  ROAM_FLUENCY_CALF_TASK_IDS,
  ROAM_ALPACA_TASK_IDS,
} from '@roar-platform/assessment-schema/roam-apps';

/**
 * This function calculates computed scores given raw scores for each subtask.
 *
 * The input raw scores are expected to conform to the following interface:
 *
 * interface IRawScores {
 *   [key: string]: {
 *     practice: ISummaryScores;
 *     test: ISummaryScores;
 *   };
 * }
 *
 * where the top-level keys correspond to this assessment's subtasks. If this
 * assessment has no subtasks, then there will be only one top-level key called
 * "total." Each summary score object implements this interface:
 *
 * interface ISummaryScores {
 *   thetaEstimate: number | null;
 *   thetaSE: number | null;
 *   numAttempted: number;
 *   numCorrect: number;
 *   numIncorrect: number;
 * }
 *
 * The returned computed scores must have that same top-level keys as the input
 * raw scores, and each value must be a single number or null.
 *
 * @param {*} rawScores
 * @returns {*} computedScores
 */
export const computedScoreCallback = (rawScores) => {
  // This returns an object with the same top-level keys as the input raw scores
  // But the values are the number of correct trials, not including practice trials.
  const taskName = store.session.get('config').taskName;
  const responseMode = store.session.get('config').responseMode;
  const calculateRawScore = (numCorrect, numIncorrect, subtask) => {
    if (
      (subtask === ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.MULTIPLE_CHOICE && taskName === ROAM_FLUENCY_ARF_TASK_IDS.EN) ||
      subtask === ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.RT_CONTROL_2AFC ||
      (subtask !== ROAM_FLUENCY_SUBTASK_DOMAINS.SYMBOLIC_COMP && responseMode === '2afc')
    ) {
      //for 2AFC, score = correct-incorrect
      return Math.max(0, numCorrect - numIncorrect);
    } else if (
      (subtask === ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.MULTIPLE_CHOICE && taskName === ROAM_FLUENCY_CALF_TASK_IDS.EN) ||
      subtask === ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.RT_CONTROL_6AFC ||
      responseMode === '6afc'
    ) {
      //for 6AFC, score = correct-0.2*incorrect
      return Math.max(0, _round(numCorrect - 0.2 * numIncorrect, 2));
    } else {
      //for alpaca and fluency production and magpi, score = correct
      return numCorrect;
    }
  };

  const getNumAttempted = (subtask, rawAttempted) => {
    if (store.session.get('responseModality')) {
      //response modality version of ARF and CALF
      if (subtask === ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.MULTIPLE_CHOICE) {
        return store.session.get('trialNumTotalAFC');
      } else if (subtask === ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.FREE_RESPONSE) {
        return store.session.get('trialNumTotalProduction');
      } else if (subtask === ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.RT_CONTROL_2AFC) {
        return store.session.get('trialNumTotalControl2afc');
      } else if (subtask === ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.RT_CONTROL_6AFC) {
        return store.session.get('trialNumTotalControl6afc');
      } else {
        return store.session.get('trialNumTotalControlProduction');
      }
    } else if (store.session.get('magpiPilot') && taskName === ROAM_FLUENCY_ARF_TASK_IDS.EN) {
      if (subtask !== COMPOSITE_DOMAIN) {
        return rawAttempted;
      } else {
        return store.session.get('trialNumTotal');
      }
    } else if (taskName === ROAM_ALPACA_TASK_IDS.EN && subtask !== COMPOSITE_DOMAIN) {
      if (subtask === ROAM_ALPACA_SUBTASK_DOMAINS.NUMBER_LINE) {
        return rawAttempted;
      }
      //Alpaca subtasks total attempted
      return store.session.get('gradeEstimateObject')[subtask].totalAttempted;
    } else if (taskName !== ROAM_ALPACA_TASK_IDS.EN && subtask !== COMPOSITE_DOMAIN) {
      //ARF or CALF standard versions
      return rawAttempted; // just use the raw score
    } else {
      //any of the math tasks, composite variable
      return store.session.get('trialNumTotal');
    }
  };

  const calculateRoarScore = (thetaScore) => {
    return Math.round(((thetaScore + 6) * 200) / 3 + 100);
  };

  const getSkillsToWorkOn = () => {
    let skillScores = store.session.get('skillScores');
    let skillsWork = [];

    for (let key in skillScores) {
      if (skillScores[key].flag) {
        skillsWork.push(key);
      }
    }
    return skillsWork;
  };

  const computedScores = _mapValues(rawScores, (subtaskScores, subtask) => {
    let numAttempted = 0;
    let rawScore = 0;
    let numCorrect = 0;
    let numIncorrect = 0;
    if (Object.hasOwn(subtaskScores, AssessmentStage.TEST)) {
      numCorrect = subtaskScores[AssessmentStage.TEST].numCorrect;
      numIncorrect = subtaskScores[AssessmentStage.TEST].numIncorrect;
      numAttempted = getNumAttempted(subtask, subtaskScores[AssessmentStage.TEST].numAttempted);
      rawScore = calculateRawScore(numCorrect, numIncorrect, subtask);
    }

    if (subtask !== COMPOSITE_DOMAIN) {
      let subPercentCorrect = numAttempted != 0 ? numCorrect / numAttempted : 0;
      if (taskName === ROAM_ALPACA_TASK_IDS.EN) {
        if (subtask === ROAM_ALPACA_SUBTASK_DOMAINS.NUMBER_LINE) {
          return {
            numCorrect: numCorrect,
            numIncorrect: numIncorrect,
            numAttempted: numAttempted,
            rawScore: rawScore,
          };
        } else {
          //Alpaca subtasks
          let gradeScore = null;
          let supportCategory = null;
          if (Object.hasOwn(store.session.get('gradeEstimateObject'), subtask)) {
            gradeScore = store.session.get('gradeEstimateObject')[subtask].gradeScore;
            supportCategory = store.session.get('gradeEstimateObject')[subtask].supportCategory;
          }

          return {
            numCorrect: numCorrect,
            numIncorrect: numIncorrect,
            numAttempted: numAttempted,
            rawScore: rawScore,
            subPercentCorrect: _round(subPercentCorrect, 2),
            gradeEstimate: gradeScore,
            supportLevel: supportCategory,
          };
        }
      } else {
        //ARF and CALF subtasks
        if (store.session.get('responseModality') || subtask === ROAM_FLUENCY_SUBTASK_DOMAINS.SYMBOLIC_COMP) {
          return {
            numCorrect: numCorrect,
            numIncorrect: numIncorrect,
            numAttempted: numAttempted,
            rawScore: rawScore,
          };
        } else {
          let assessedSkills = null;
          if (Object.hasOwn(store.session.get('assessedSkills'), subtask)) {
            assessedSkills = store.session.get('assessedSkills')[subtask].join(', ');
          }

          return {
            numCorrect: numCorrect,
            numIncorrect: numIncorrect,
            numAttempted: numAttempted,
            rawScore: rawScore,
            subPercentCorrect: _round(subPercentCorrect, 2),
            skillsAssessed: assessedSkills,
          };
        }
      }
    } else {
      //Any task's Composite: It doesn't matter what's returned because it will be fixed later
      return {
        numCorrect: numCorrect,
        numIncorrect: numIncorrect,
        numAttempted: numAttempted,
        rawScore: rawScore,
      };
    }
  });

  let totalScore, totalNumAttempted;
  let omitList = [COMPOSITE_DOMAIN];
  if (store.session.get('responseModality')) {
    omitList = [
      COMPOSITE_DOMAIN,
      ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.RT_CONTROL_6AFC,
      ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.RT_CONTROL_2AFC,
      ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.RT_CONTROL_PRODUCTION,
    ];
  } else if (store.session.get('magpiPilot') && taskName === ROAM_FLUENCY_ARF_TASK_IDS.EN) {
    omitList = [COMPOSITE_DOMAIN, ROAM_FLUENCY_SUBTASK_DOMAINS.SYMBOLIC_COMP];
  } else if (store.session.get('magpiPilot') && taskName === ROAM_ALPACA_TASK_IDS.EN) {
    omitList = [COMPOSITE_DOMAIN, ROAM_ALPACA_SUBTASK_DOMAINS.NUMBER_LINE];
  }
  // The `else` branch below (direct `computedScores.composite` access) is only valid
  // when the accumulator's sole key really is the literal 'composite' domain — which
  // the SDK only produces when a trial carries no explicit `subtask` field unlike firekit
  // which appended composite to rawScore automatically.
  if (Object.keys(computedScores).length > 1 || !Object.hasOwn(computedScores, COMPOSITE_DOMAIN)) {
    if (store.session.get('responseModality')) {
      //for response modality composite
      totalScore = Object.hasOwn(computedScores, ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.FREE_RESPONSE)
        ? computedScores[ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.FREE_RESPONSE].rawScore
        : 0;
    } else if ((taskName === ROAM_FLUENCY_ARF_TASK_IDS.EN || taskName === ROAM_FLUENCY_CALF_TASK_IDS.EN) && responseMode.includes('afc')) {
      //do nothing
    } else {
      totalScore = _reduce(_omit(computedScores, omitList), (sum, score) => sum + score.rawScore, 0);
    }

    totalNumAttempted = _reduce(_omit(computedScores, omitList), (sum, score) => sum + score.numAttempted, 0);
  } else {
    totalScore = computedScores[COMPOSITE_DOMAIN].rawScore;
    totalNumAttempted = computedScores[COMPOSITE_DOMAIN].numAttempted;
  }

  if (taskName === ROAM_ALPACA_TASK_IDS.EN) {
    let thetaScoreRaw = store.session.get('thetaEstimateRaw');
    let thetaScore = store.session.get('thetaEstimate');
    let gradeScore = null;
    let supportCategory = null;
    let totalCorrect = 0;
    if (Object.hasOwn(store.session.get('gradeEstimateObject'), COMPOSITE_DOMAIN)) {
      gradeScore = store.session.get('gradeEstimateObject')[COMPOSITE_DOMAIN].gradeScore;
      supportCategory = store.session.get('gradeEstimateObject')[COMPOSITE_DOMAIN].supportCategory;
      totalCorrect = store.session.get('gradeEstimateObject')[COMPOSITE_DOMAIN].totalCorrect;
    }

    //calculated from the IRT theta estimate according to https://roar.stanford.edu/technical/intro-swr.html#sec-swr-scoring
    let roarScore = calculateRoarScore(thetaScore);

    //get the incorrect item skills below grade level
    let incorrectSkills = getSkillsToWorkOn();
    if (incorrectSkills.length > 0) {
      incorrectSkills = incorrectSkills.join(', ');
    }

    computedScores[COMPOSITE_DOMAIN] = {
      numCorrect: totalCorrect,
      numIncorrect: totalNumAttempted - totalCorrect,
      numAttempted: totalNumAttempted,
      thetaEstimateRaw: _round(thetaScoreRaw, 2),
      thetaEstimate: _round(thetaScore, 2),
      roarScore: roarScore,
      rawScore: totalScore,
      gradeEstimate: gradeScore,
      supportLevel: supportCategory,
      incorrectSkills: incorrectSkills,
    };
  } else {
    if (store.session.get('responseModality')) {
      computedScores[COMPOSITE_DOMAIN] = {
        numCorrect: store.session.get('totalCorrect'),
        numIncorrect: totalNumAttempted - store.session.get('totalCorrect'),
        numAttempted: totalNumAttempted,
        rawScore: totalScore,
      };
    } else {
      let incorrectSkills = store.session.get('incorrectSkills');
      let assessedSkills = store.session.get('assessedSkills');

      let totalCorrect = store.session.get('totalCorrect');
      //calculate total score based on the actual total correct score
      totalScore = calculateRawScore(totalCorrect, totalNumAttempted - totalCorrect, COMPOSITE_DOMAIN);

      let subPercentCorrect = totalNumAttempted != 0 ? totalCorrect / totalNumAttempted : 0;

      let worstFacts = store.session.get('worstFacts');
      for (let i = 0; i < worstFacts.length; i++) {
        if (assessedSkills[ROAM_FLUENCY_SUBTASK_DOMAINS.MULTIPLICATION].includes(worstFacts[i])) {
          if (!Object.hasOwn(incorrectSkills, ROAM_FLUENCY_SUBTASK_DOMAINS.MULTIPLICATION)) {
            incorrectSkills[ROAM_FLUENCY_SUBTASK_DOMAINS.MULTIPLICATION] = [];
          }
          incorrectSkills[ROAM_FLUENCY_SUBTASK_DOMAINS.MULTIPLICATION].push(worstFacts[i]);
        }

        if (Object.hasOwn(assessedSkills, ROAM_FLUENCY_SUBTASK_DOMAINS.DIVISION)) {
          if (assessedSkills[ROAM_FLUENCY_SUBTASK_DOMAINS.DIVISION].includes(worstFacts[i])) {
            if (!Object.hasOwn(incorrectSkills, ROAM_FLUENCY_SUBTASK_DOMAINS.DIVISION)) {
              incorrectSkills[ROAM_FLUENCY_SUBTASK_DOMAINS.DIVISION] = [];
            }
            incorrectSkills[ROAM_FLUENCY_SUBTASK_DOMAINS.DIVISION].push(worstFacts[i]);
          }
        }
      }

      Object.keys(incorrectSkills).forEach((key) => {
        incorrectSkills[key] = incorrectSkills[key].join(', ');
      });

      computedScores[COMPOSITE_DOMAIN] = {
        numCorrect: totalCorrect,
        numIncorrect: totalNumAttempted - totalCorrect,
        numAttempted: totalNumAttempted,
        subPercentCorrect: _round(subPercentCorrect, 2),
        rawScore: totalScore,
        incorrectSkills: incorrectSkills,
      };
    }
  }

  return computedScores;
};

/**
 * This function normalizes computed scores using participant demographic data.
 *
 * For example, it may return a percentile score and a predicted score on another
 * standardized test.
 *
 * The input computed scores are expected to conform to output of the
 * computedScoreCallback() function, with top-level keys corresponding to this
 * assessment's subtasks and values that are either numbers or null.
 *
 * The returned normalized scores must have that same top-level keys as the input and can
 * have arbitrary nested values. For example, one might return both a percentile
 * score and a predicted Woodcock-Johnson score:
 *
 * {
 *   total: {
 *    percentile: number;
 *    wJPercentile: number;
 *   }
 * }
 *
 * @param {*} computedScores
 * @param {*} demographic_data
 * @returns {*} normedScores
 */
// eslint-disable-next-line no-unused-vars
export const normedScoreCallback = (computedScores, demographic_data) => {
  // TODO: Add table lookup after norms have been collected and established.
  return Object.fromEntries(Object.entries(computedScores).map(([key, val]) => [key, val]));
};
