import _mapValues from 'lodash/mapValues';
import _omit from 'lodash/omit';
import store from 'store2';
import * as Papa from 'papaparse';
import { getGrade } from '@bdelab/roar-utils';
import { selectNormRow, clampToRange } from '@roar-platform/scoring-tables';
import { clowder, scaleTheta } from './experimentSetup';
import { makeFinite } from './helperFunctions';
import { getItemGroupStats } from './trials/stimulusLetterName';
import {
  LETTER_TASK_IDS,
  PHONICS_TASK_IDS,
  LETTER_SCORE_TABLE_URL,
} from '@roar-platform/assessment-schema/roar-letter';
import { COMPOSITE_DOMAIN, COMPOSITE_FOUNDATIONAL_DOMAIN } from '@roar-platform/assessment-schema';

/**
 * Extracts age in months from user metadata, converting from grade if needed.
 * Clamps the result to the valid range [60, 96] months.
 *
 * @returns {number} Age in months, clamped to [60, 96]
 * @throws {Error} If neither ageMonths nor grade is available
 */
function getClampedAgeForScore() {
  const ageMin = 60;
  const ageMax = 96;

  let ageInMonths = store.session.get('config').userMetadata?.ageMonths;
  const grade = getGrade(store.session.get('config').userMetadata?.grade);

  // Note: We use == instead of === because we want to catch both undefined and null.

  if (ageInMonths == undefined) {
    if (grade == undefined) throw new Error('Age or grade is undefined');

    ageInMonths = 66 + grade * 12;
  }

  return clampToRange(ageInMonths, { min: ageMin, max: ageMax });
}

export class RoarScores {
  constructor() {
    this.scoringVersion = parseInt(store.session.get('config').scoringVersion, 10);
    this.roarScoreKind = 'scaled_irt';
    this.tableURL = LETTER_SCORE_TABLE_URL(this.scoringVersion);
    this.lookupTable = [];
    this.tableLoaded = false;
    this.tableLoadingPromise = null;
    this.tableLoadingError = null;
  }

  async initTable() {
    return new Promise((resolve, reject) => {
      try {
        this.ageForScore = getClampedAgeForScore();
      } catch (error) {
        reject(error);
        return;
      }

      Papa.parse(this.tableURL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        step: (row) => {
          if (Number(this.ageForScore) === Number(row.data.ageMonths)) {
            this.lookupTable.push(_omit(row.data, ['', 'X']));
          }
        },
        complete: (results) => {
          this.tableLoaded = true;
          resolve(results.data);
        },
        error: (err) => {
          this.tableLoadingPromise = null;
          // Reset to prevent stale data on retry
          this.lookupTable = [];
          reject(err);
        },
      });
    });
  }

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
  computedScoreCallback = async (rawScores) => {
    const { taskId } = store.session.get('config');

    // config.taskId is derived from task + language by resolveTaskId() in config.js, so it
    // correctly distinguishes all variants: 'letter' (EN), 'letter-es', 'letter-en-ca', 'phonics'.
    // Exit for non-English letter variants — they have no normed scoring and no IRT theta.
    if (taskId !== LETTER_TASK_IDS.EN && taskId !== PHONICS_TASK_IDS.EN) return null;

    const computedScores = _mapValues(rawScores, (subtaskScores) => {
      const subScore = subtaskScores.test?.numCorrect || 0;
      const numAttempted = subtaskScores.test?.numAttempted;
      const subPercentCorrect =
        typeof numAttempted === 'number' && numAttempted > 0 ? Math.round((100 * subScore) / numAttempted) : 0;

      if (taskId === LETTER_TASK_IDS.EN) {
        const lowerCorrect = store.session('lowerCorrectItems');
        const lowerIncorrect = store.session('lowerIncorrectItems');
        const upperCorrect = store.session('upperCorrectItems');
        const upperIncorrect = store.session('upperIncorrectItems');
        const phonemeCorrect = store.session('phonemeCorrectItems');
        const phonemeIncorrect = store.session('phonemeIncorrectItems');

        return {
          subScore: subScore,
          subPercentCorrect: subPercentCorrect,
          lowerCorrect: lowerCorrect.join(','),
          lowerIncorrect: lowerIncorrect.join(','),
          upperCorrect: upperCorrect.join(','),
          upperIncorrect: upperIncorrect.join(','),
          phonemeCorrect: phonemeCorrect.join(','),
          phonemeIncorrect: phonemeIncorrect.join(','),
        };
      }

      // Default return value for other tasks
      return {
        subScore,
        subPercentCorrect,
      };
    });

    // computedScores should now have keys for each subtask.
    // But we also want to update the composite score

    let letterCompositeIRTScores = {};
    let foundationalCompositeIRTScores = {};
    if (taskId === LETTER_TASK_IDS.EN) {
      const thetaEstimateRaw = clowder.theta[COMPOSITE_DOMAIN];
      const thetaSERaw = makeFinite(clowder.seMeasurement[COMPOSITE_DOMAIN]);
      const [thetaEstimate, thetaSE] = scaleTheta(thetaEstimateRaw, thetaSERaw);
      letterCompositeIRTScores = {
        thetaEstimateRaw,
        thetaSERaw,
        thetaEstimate,
        thetaSE: makeFinite(thetaSE),
      };

      const foundationalThetaEstimateRaw = clowder.theta[COMPOSITE_FOUNDATIONAL_DOMAIN];
      const foundationalThetaSERaw = makeFinite(clowder.seMeasurement[COMPOSITE_FOUNDATIONAL_DOMAIN]);
      const [foundationalThetaEstimate, foundationalThetaSE] = scaleTheta(
        foundationalThetaEstimateRaw,
        foundationalThetaSERaw,
      );
      foundationalCompositeIRTScores = {
        thetaEstimateRaw: foundationalThetaEstimateRaw,
        thetaSERaw: foundationalThetaSERaw,
        thetaEstimate: foundationalThetaEstimate,
        thetaSE: makeFinite(foundationalThetaSE),
      };

      computedScores[COMPOSITE_DOMAIN] = {
        totalCorrect: store.session('totalCorrect'),
        totalNumAttempted: store.session.get('trialNumTotal'),
        totalPercentCorrect: store.session('totalPercentCorrect'),
        ...letterCompositeIRTScores,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      };

      computedScores[COMPOSITE_FOUNDATIONAL_DOMAIN] = {
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
        ...foundationalCompositeIRTScores,
      };
    } else {
      // Initialize composite for phonics runs (no IRT theta)
      computedScores[COMPOSITE_DOMAIN] = {
        totalCorrect: store.session('totalCorrect'),
        totalNumAttempted: store.session.get('trialNumTotal'),
        totalPercentCorrect: store.session('totalPercentCorrect'),
      };
    }

    if (taskId === PHONICS_TASK_IDS.EN) {
      computedScores[COMPOSITE_DOMAIN] = {
        ...computedScores[COMPOSITE_DOMAIN],
        subscores: {
          cvc: getItemGroupStats('cvc'), // consonant-vowel-consonant
          digraph: getItemGroupStats('digraph'), // digraph
          initial_blend: getItemGroupStats('i-blend'), // initial blend
          tri_blend: getItemGroupStats('tri-blend'), // three consonant blends
          final_blend: getItemGroupStats('f-blend'), // final blend
          r_controlled: getItemGroupStats('r-ctrl'), // r-controlled vowel
          r_cluster: getItemGroupStats('r-tri'), // other r-controlled patterns
          silent_e: getItemGroupStats('silent-e'), // silent-e
          vowel_team: getItemGroupStats('vt'), // vowel team
        },
      };
    }

    const { userMetadata } = store.session.get('config');
    const rawGrade = userMetadata?.grade;
    const ageMonths = userMetadata?.ageMonths;

    if ((rawGrade != null || ageMonths != null) && taskId === LETTER_TASK_IDS.EN) {
      if (!this.tableLoaded) {
        if (!this.tableLoadingPromise) {
          this.tableLoadingPromise = this.initTable();
        }

        try {
          // Subsequent calls await the same promise to avoid multiple network requests
          await this.tableLoadingPromise;
          // Clear error on successful load
          this.tableLoadingError = null;
        } catch (error) {
          // Only log when error state changes to avoid flooding logs
          const errorMessage = error?.message || error;
          const previousErrorMessage = this.tableLoadingError?.message || this.tableLoadingError;
          if (previousErrorMessage !== errorMessage) {
            console.error('Error loading scoring table:', errorMessage);
            this.tableLoadingError = error;
          }
        }
      }

      let myRow;
      const { thetaEstimate } = letterCompositeIRTScores;

      // Scale/precision contract with CSV generation pipeline.
      // thetaEstimate here is the scaled value (from scaleTheta). The lookup CSV's
      // thetaEstimate column must be generated at the same scale and with 0.1 granularity.
      // Both are rounded to 1 decimal place for matching. A mismatch in scale or precision
      // causes silent lookup failures (no normed score attached). If lookup fails, verify:
      // 1. scaleTheta() output matches the CSV's scale
      // 2. CSV thetaEstimate values are rounded to 0.1 granularity
      if (thetaEstimate !== undefined && thetaEstimate !== null) {
        myRow = selectNormRow(this.lookupTable, {
          keyColumn: 'ageMonths',
          keyValue: Number(this.ageForScore),
          scoreColumn: 'thetaEstimate',
          scoreValue: thetaEstimate,
          matchMode: 'theta',
        });
      }

      if (myRow !== undefined) {
        const { ageMonths: rowAgeMonths, thetaEstimate: rowThetaEstimate, ...normedScores } = myRow;

        computedScores[COMPOSITE_DOMAIN] = {
          ...computedScores[COMPOSITE_DOMAIN],
          ...normedScores,
          roarScoreKind: this.roarScoreKind,
          scoringVersion: this.scoringVersion,
        };
      }
    }

    return computedScores;
  };
}

let roarScoresInstance = null;

export const computedScoreCallback = async (rawScores) => {
  if (!roarScoresInstance) {
    roarScoresInstance = new RoarScores();
  }
  return roarScoresInstance.computedScoreCallback(rawScores);
};
