import _mapValues from 'lodash/mapValues';
import _omit from 'lodash/omit';
import * as Papa from 'papaparse';
import store from 'store2';
import { getGrade } from '@bdelab/roar-utils';

export class RoarScores {
  constructor() {
    // reference: Table_theta_brs_model_0.4.csv
    this.scoringVersion = parseInt(store.session.get('config').scoringVersion, 10);
    this.lookupTable = [];
    this.tableLoaded = false;
    this.tableLoadingPromise = null;
    this.tableLoadingError = null;
  }

  async initTable(taskId) {
    const formattedTaskId = taskId.replace('-', '_');
    this.tableURL = `https://storage.googleapis.com/roar-swr/scores/${formattedTaskId}_lookup_v${this.scoringVersion}.csv`;

    return new Promise((resolve, reject) => {
      let ageInMonths = store.session.get('config').userMetadata?.ageMonths;

      // Note: We use == instead of === because we want to catch both undefined and null.

      if (ageInMonths == undefined) {
        const grade = getGrade(store.session.get('config').userMetadata?.grade);

        if (grade == undefined) {
          reject(new Error('Cannot determine age: both ageMonths and grade are undefined'));
          return;
        }

        ageInMonths = 66 + grade * 12;
      }

      const ageMin = 72;
      const ageMax = 216;

      this.ageForScore = ageInMonths;
      if (ageInMonths < ageMin) this.ageForScore = ageMin;
      if (ageInMonths > ageMax) this.ageForScore = ageMax;

      // If grade is over 6, grab the grade specific table for Spr_percentile
      Papa.parse(this.tableURL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        step: (row) => {
          if (this.ageForScore === Number(row.data.ageMonths)) {
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
   * "composite." Each summary score object implements this interface:
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
   * raw scores, and each value must be an object with arbitrary computed scores.
   * For example, one might return the thetaEstimate, a "ROAR score", a percentile
   * score, and a predicted Woodcock-Johnson score:
   *
   * {
   *   composite: {
   *    thetaEstimate: number;
   *    roarScore: number;
   *    percentile: number;
   *    wjPercentile: number;
   *   }
   * }
   *
   * @param {*} rawScores
   * @returns {*} computedScores
   */
  computedScoreCallback = async (rawScores) => {
    const { userMetadata, taskId } = store.session.get('config');

    if (!['swr', 'swr-es'].includes(taskId)) return null;

    const configAge = userMetadata?.ageMonths;
    const grade = getGrade(userMetadata?.grade);
    const isNormed = taskId === 'swr' || (taskId === 'swr-es' && this.scoringVersion === 1);

    if (configAge != undefined || grade != undefined) {
      if (!this.tableLoaded && isNormed) {
        if (!this.tableLoadingPromise) {
          this.tableLoadingPromise = this.initTable(taskId);
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
    }

    // This returns an object with the same top-level keys as the input raw scores
    // but the values are the theta estimates
    const computedScores = _mapValues(rawScores, (subtaskScores) => {
      const score = subtaskScores.test?.thetaEstimate === undefined ? null : subtaskScores.test?.thetaEstimate;
      let computedScore = {
        thetaEstimate: score,
      };

      if (score != undefined) {
        const rounded = Number(score.toFixed(1));
        const { ageForScore } = this;

        const myRow = this.lookupTable.find(
          (row) =>
            Number(Number(row.ageMonths).toFixed(1)) === ageForScore &&
            Number(Number(row.thetaEstimate).toFixed(1)) === rounded,
        );

        if (myRow !== undefined) {
          const { ageMonths, thetaEstimate, ...normedScores } = myRow;

          computedScore = {
            ...computedScore,
            ...normedScores,
            scoringVersion: this.scoringVersion,
          };
        }
      }

      return computedScore;
    });

    return computedScores;
  };
}
