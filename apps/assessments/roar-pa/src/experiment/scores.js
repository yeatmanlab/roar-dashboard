import _mapValues from 'lodash/mapValues';
import _omit from 'lodash/omit';
import _reduce from 'lodash/reduce';
import * as Papa from 'papaparse';
import store from 'store2';
import { getGrade } from '@bdelab/roar-utils';
import {
  PA_TASK_ID,
  PA_SCORING_VERSION,
  PA_SCORE_KIND,
  PA_SCORE_TABLE_URL,
} from '@roar-dashboard/assessment-schema/pa';

export class RoarScores {
  constructor() {
    const { isAdaptive } = store.session.get('config');
    this.irtScoring = Boolean(isAdaptive);
    if (this.irtScoring) {
      this.scoringVersion = PA_SCORING_VERSION.ADAPTIVE;
      this.roarScoreKind = PA_SCORE_KIND.ADAPTIVE;
    } else {
      this.scoringVersion = PA_SCORING_VERSION.FIXED;
      this.roarScoreKind = PA_SCORE_KIND.FIXED;
    }
    this.tableURL = PA_SCORE_TABLE_URL(this.scoringVersion);
    this.lookupTable = [];
    this.tableLoaded = false;
  }

  isAdaptiveScoring() {
    return this.scoringVersion >= 4;
  }

  async initTable() {
    return new Promise((resolve, reject) => {
      const ageInMonths = store.session.get('config').userMetadata?.ageMonths;
      const grade = getGrade(store.session.get('config').userMetadata?.grade);

      if (ageInMonths == undefined && grade == undefined) reject();

      const ageMin = this.isAdaptiveScoring() ? 60 : 48;
      const ageMax = this.isAdaptiveScoring() ? 120 : 144;

      this.ageForScore = ageInMonths;
      if (ageInMonths < ageMin) this.ageForScore = ageMin;
      if (ageInMonths > ageMax) this.ageForScore = ageMax;

      Papa.parse(this.tableURL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        step: (row) => {
          if (this.isAdaptiveScoring() && this.ageForScore === Number(row.data.ageMonths)) {
            // If adaptive, lookup scores by age only.
            this.lookupTable.push(_omit(row.data, ['', 'X']));
          } else if (grade && grade >= 6) {
            // Otherwise, lookup by grade if the user is in grade 6 or above.
            if (grade === Number(row.data.grade)) {
              this.lookupTable.push(_omit(row.data, ['', 'X']));
            }
          } else if (this.ageForScore === Number(row.data.ageMonths)) {
            // Otherwise, lookup by age in months.
            this.lookupTable.push(_omit(row.data, ['', 'X']));
          }
        },
        complete: () => {
          this.tableLoaded = true;
          resolve();
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
   *   fsm: {
   *     roarScore: x;
   *   },
   *   lsm: {
   *     roarScore: y;
   *   },
   *   del: {
   *     roarScore: z;
   *   },
   *   composite: {
   *     roarScore: x + y + z;
   *     standardScore: number;
   *     percentile: number;
   *   }
   * }
   *
   * @param {*} rawScores
   * @returns {*} computedScores
   */
  computedScoreCallback = async (rawScores) => {
    const { taskId } = store.session.get('config');
    if (taskId !== PA_TASK_ID) return null;

    // This returns an object with the same top-level keys as the input raw scores
    // But the values are the number of correct trials, not including practice trials.
    const computedScores = _mapValues(rawScores, (subtaskScores) => {
      const { numCorrect = 0, numAttempted = 0 } = subtaskScores.test ?? {};
      const percentCorrect = numAttempted > 0 ? Math.round((100 * numCorrect) / numAttempted) : 0;
      return {
        ...(this.isAdaptiveScoring() ? {} : { roarScore: numCorrect }),
        numCorrect,
        percentCorrect,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      };
    });

    // computedScores should now have keys for lsm, fsm, and del.
    // But we also want to update the total score so we add up all of the others.
    const totalScore = _reduce(
      _omit(computedScores, ['composite', 'composite_foundational']),
      (sum, score) => sum + score.roarScore,
      0,
    );

    if (this.isAdaptiveScoring()) {
      for (const key of Object.keys(computedScores)) {
        computedScores[key].thetaEstimate = store.session.get('thetas')[key.toLowerCase()];
        computedScores[key].thetaSE = store.session.get('thetaSEs')[key.toLowerCase()];
      }

      const compositeThetas = {
        thetaEstimate: store.session.get('thetas').scaled,
        thetaSE: store.session.get('thetaSEs').scaled,
        thetaEstimateRaw: store.session.get('thetas').composite,
        thetaSERaw: store.session.get('thetaSEs').composite,
      };

      const compositeFoundationalThetas = {
        thetaEstimate: store.session.get('thetas').composite_foundational,
        thetaSE: store.session.get('thetaSEs').composite_foundational,
        thetaEstimateRaw: store.session.get('thetas').composite_foundational,
        thetaSERaw: store.session.get('thetaSEs').composite_foundational,
      };

      computedScores.composite = {
        ...computedScores.composite,
        ...compositeThetas,
      };

      computedScores.composite_foundational = {
        ...computedScores.composite_foundational,
        ...compositeFoundationalThetas,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      };
    }

    const { userMetadata } = store.session.get('config');
    const grade = getGrade(userMetadata?.grade);
    const ageMonths = userMetadata?.ageMonths;

    if (grade != undefined || ageMonths != undefined) {
      if (!this.tableLoaded) {
        await this.initTable();
      }

      // Then we find the row in the lookup table that corresponds to the total score.
      let myRow;
      const { ageForScore } = this;

      if (this.isAdaptiveScoring()) {
        const thetaEstimate = store.session.get('thetas').scaled;
        const roundedTheta = Number(thetaEstimate.toFixed(1));
        myRow = this.lookupTable.find(
          (row) =>
            Number(row.ageMonths) === ageForScore && Number(Number(row.thetaEstimate).toFixed(1)) === roundedTheta,
        );
      } else if (grade < 6) {
        myRow = this.lookupTable.find((row) => Number(row.ageMonths) === ageForScore && row.roarScore === totalScore);
      } else {
        myRow = this.lookupTable.find((row) => Number(row.grade) === grade && row.roarScore === totalScore);
      }

      if (myRow !== undefined) {
        // And add columns in the lookup table except for the age and roarScore.
        const { roarScore, ...normedScores } = _omit(myRow, ['ageMonths', 'grade']);

        computedScores.composite = {
          ...computedScores.composite,
          ...normedScores,
          // If adaptive, conditionally insert roarScore into the computed scores
          ...(this.isAdaptiveScoring() ? { roarScore } : {}),
          roarScoreKind: this.roarScoreKind,
          scoringVersion: this.scoringVersion,
        };
      }
    }

    return computedScores;
  };
}
