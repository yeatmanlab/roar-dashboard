import _mapValues from 'lodash/mapValues';
import _omit from 'lodash/omit';
import store from 'store2';
import * as Papa from 'papaparse';
import { getGrade } from '@bdelab/roar-utils';
import { selectNormRow, clampToRange } from '@roar-platform/scoring-tables';
import { clowder, scaleTheta } from './experimentSetup';
import { clampPositive } from './helperFunctions';

/**
 * Extracts age in months from user metadata, converting from grade if needed.
 * Clamps the result to the valid range [84, 180] months.
 *
 * @returns {number} Age in months, clamped to [84, 180]
 * @throws {Error} If neither ageMonths nor grade is available
 */
function getClampedAgeForScore() {
  const ageMin = 84;
  const ageMax = 180;

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
    const config = store.session.get('config');
    const task = config.task;
    const scoringVersion = config.scoringVersion;

    this.scoringVersion = scoringVersion ? parseInt(scoringVersion, 10) : 1;
    this.roarScoreKind = 'scaled_irt';

    const taskPrefix = task === 'cva' ? 'cva_lookup' : 'morphology_lookup';
    this.tableURL = `https://storage.googleapis.com/roar-survey/scores/${taskPrefix}_v${this.scoringVersion}.csv`;

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
    const { isAdaptive } = store.session.get('config');
    const computedScores = _mapValues(rawScores, (subtaskScores) => {
      const subScore = subtaskScores.test?.numCorrect || 0;
      const numAttempted = subtaskScores.test?.numAttempted;
      const subPercentCorrect =
        typeof numAttempted === 'number' && numAttempted > 0 ? Math.round((100 * subScore) / numAttempted) : 0;

      return {
        subScore,
        subPercentCorrect,
      };
    });

    // computedScores should now have keys for each subtask.
    // But we also want to update the composite score

    let compositeIRTScores = {};
    let comprehensionCompositeIRTScores = {};
    if (isAdaptive) {
      const thetaEstimateRaw = clowder?.theta?.core;
      const thetaSERaw = clampPositive(clowder?.seMeasurement?.core);
      const comprehensionThetaEstimateRaw = clowder?.theta?.composite_comprehension;
      const comprehensionThetaSERaw = clampPositive(clowder?.seMeasurement?.composite_comprehension);
      const [thetaEstimate, thetaSE, comprehensionThetaEstimate, comprehensionThetaSE] = scaleTheta(
        thetaEstimateRaw,
        thetaSERaw,
        comprehensionThetaEstimateRaw,
        comprehensionThetaSERaw,
      );
      compositeIRTScores = {
        thetaEstimateRaw,
        thetaSERaw,
        thetaEstimate,
        thetaSE: clampPositive(thetaSE),
      };

      comprehensionCompositeIRTScores = {
        thetaEstimateRaw: comprehensionThetaEstimateRaw,
        thetaSERaw: comprehensionThetaSERaw,
        thetaEstimate: comprehensionThetaEstimate,
        thetaSE: clampPositive(comprehensionThetaSE),
      };
    }

    // Only include composite scores for adaptive tasks
    if (isAdaptive) {
      computedScores.composite = {
        totalCorrect: store.session.get('totalCorrect'),
        totalNumAttempted: store.session.get('trialNumTotal'),
        totalPercentCorrect: store.session.get('totalPercentCorrect'),
        ...compositeIRTScores,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      };

      computedScores.composite_comprehension = {
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
        ...comprehensionCompositeIRTScores,
      };
    }

    const { userMetadata } = store.session.get('config');
    const rawGrade = userMetadata?.grade;
    const ageMonths = userMetadata?.ageMonths;

    if ((rawGrade != null || ageMonths != null) && isAdaptive) {
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
      const { thetaEstimate } = compositeIRTScores;

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
          keyValue: this.ageForScore,
          scoreColumn: 'thetaEstimate',
          scoreValue: thetaEstimate,
          matchMode: 'theta',
        });
      }

      if (myRow !== undefined) {
        const { ageMonths: rowAgeMonths, thetaEstimate: rowThetaEstimate, ...normedScores } = myRow;

        computedScores.composite = {
          totalCorrect: store.session.get('totalCorrect'),
          totalNumAttempted: store.session.get('trialNumTotal'),
          totalPercentCorrect: store.session.get('totalPercentCorrect'),
          ...compositeIRTScores,
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
