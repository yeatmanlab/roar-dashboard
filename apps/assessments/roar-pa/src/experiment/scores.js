import _mapValues from 'lodash/mapValues';
import _omit from 'lodash/omit';
import _reduce from 'lodash/reduce';
import * as Papa from 'papaparse';
import store from 'store2';
import { getGrade } from '@bdelab/roar-utils';
import { selectNormRow } from '@roar-platform/scoring-tables';
import { COMPOSITE_DOMAIN, pa } from '@roar-platform/assessment-schema';

const { PA_TASK_ID, PA_SCORE_TABLE_URL, PA_SCORING_VERSION, PA_COMPOSITE_FOUNDATIONAL } = pa;

const getGradeAndAgeForScoring = (scoringVersion = 3) => {
  let ageMonths = store.session.get('config').userMetadata?.ageMonths;
  let grade = getGrade(store.session.get('config').userMetadata?.grade);
  const { taskId } = store.session.get('config');

  // If age is not provided, we calculate it based on grade
  // Note: We use == instead of === because we want to catch both undefined and null.
  // eslint-disable-next-line eqeqeq
  if (ageMonths == undefined) {
    // eslint-disable-next-line eqeqeq
    if (grade == undefined) {
      throw new Error('Attempting to determine user age from grade but grade is undefined');
    }

    ageMonths = 66 + grade * 12;
  }

  const isAdaptive = scoringVersion >= 4;
  const ageMin = isAdaptive ? 60 : 48;
  const ageMax = isAdaptive ? 130 : 144;

  if (ageMonths < ageMin) ageMonths = ageMin;
  if (ageMonths > ageMax) ageMonths = ageMax;
  // Clamp grade to [1, 12] for v3 PA if < 1 or > 12. Otherwise, leave it unchanged.
  // eslint-disable-next-line eqeqeq
  if (grade != undefined && taskId === PA_TASK_ID && scoringVersion === PA_SCORING_VERSION.V3_FIXED)
    grade = Math.min(12, Math.max(1, grade));

  return {
    ageMonths,
    grade,
  };
};

const isValidForScoring = ({ ageMonths, grade, scoringVersion }) => {
  if (scoringVersion >= PA_SCORING_VERSION.V3_FIXED) {
    // For sre v4 & sre-es v1, we need the age, or we can estimate the age from the grade
    // eslint-disable-next-line eqeqeq
    return ageMonths != undefined || grade != undefined;
  }

  throw new Error('Invalid scoring version');
};

const useGradeForScoring = ({ scoringVersion, taskId }) =>
  scoringVersion === PA_SCORING_VERSION.V3_FIXED && taskId === PA_TASK_ID;

const useAgeForScoring = ({ scoringVersion, taskId }) =>
  scoringVersion !== PA_SCORING_VERSION.V3_FIXED && taskId === PA_TASK_ID;

export class RoarScores {
  constructor() {
    const rawScoringVersion = store.session.get('config').scoringVersion;
    this.scoringVersion = rawScoringVersion !== null ? parseInt(rawScoringVersion, 10) : null;
    this.taskId = PA_TASK_ID;
    this.useAgeForScoring = useAgeForScoring({ scoringVersion: this.scoringVersion, taskId: PA_TASK_ID });
    this.useGradeForScoring = useGradeForScoring({ scoringVersion: this.scoringVersion, taskId: PA_TASK_ID });
    this.tableURL = this.scoringVersion ? PA_SCORE_TABLE_URL(this.scoringVersion) : null;
    this.lookupTable = [];
    this.tableLoaded = false;
    this.tableLoadingPromise = null;
    this.tableLoadingError = null;
    this.isValidForScoring = undefined;
    this.ageForScore = null;
    this.gradeForScore = null;
  }

  isAdaptiveScoring() {
    if (this.scoringVersion === null) {
      return false;
    }
    if (!Number.isFinite(this.scoringVersion)) {
      throw new Error(
        `Invalid scoringVersion: ${this.scoringVersion}. Expected a finite number >= ${PA_SCORING_VERSION.V4_ADAPTIVE} for adaptive scoring or < ${PA_SCORING_VERSION.V4_ADAPTIVE} for fixed scoring.`,
      );
    }
    return this.scoringVersion >= PA_SCORING_VERSION.V4_ADAPTIVE;
  }

  async initTable() {
    // Prevent race condition: if table is already loading, return the existing promise
    if (this.tableLoadingPromise) {
      return this.tableLoadingPromise;
    }

    // If table is already loaded, return immediately
    if (this.tableLoaded) {
      return Promise.resolve();
    }

    // Create and store the loading promise
    this.tableLoadingPromise = new Promise((resolve, reject) => {
      try {
        const { ageMonths, grade } = getGradeAndAgeForScoring(this.scoringVersion);

        if (!this.isAdaptiveScoring()) {
          this.isValidForScoring = isValidForScoring({
            ageMonths,
            grade,
            scoringVersion: this.scoringVersion,
          });
        } else {
          this.isValidForScoring = true;
        }

        if (!this.isValidForScoring) {
          reject(new Error('Invalid age or grade for scoring'));
          return;
        }

        this.ageForScore = ageMonths;
        this.gradeForScore = grade;

        Papa.parse(this.tableURL, {
          download: true,
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          step: (row) => {
            if (this.isAdaptiveScoring() && Number(this.ageForScore) === Number(row.data.ageMonths)) {
              // If adaptive, lookup scores by age only.
              this.lookupTable.push(_omit(row.data, ['', 'X']));
            } else if (this.gradeForScore && this.gradeForScore >= 6) {
              // Fallback: lookup by grade if the user is in grade 6 or above.
              if (this.gradeForScore === Number(row.data.grade)) {
                this.lookupTable.push(_omit(row.data, ['', 'X']));
              }
            } else if (Number(this.ageForScore) === Number(row.data.ageMonths)) {
              // Otherwise, lookup by age in months.
              this.lookupTable.push(_omit(row.data, ['', 'X']));
            }
          },
          complete: () => {
            this.tableLoaded = true;
            this.tableLoadingPromise = null;
            resolve();
          },
          error: (error) => {
            this.tableLoadingPromise = null;
            // Reset to prevent stale data on retry
            this.lookupTable = [];
            reject(error);
          },
        });
      } catch (error) {
        this.tableLoadingPromise = null;
        reject(error);
      }
    });

    return this.tableLoadingPromise;
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
   *     roarScoreKind: string;
   *     scoringVersion: number;
   *   },
   *   composite_foundational: {
   *     roarScore: x + y + z;
   *     standardScore: number;
   *     percentile: number;
   *     roarScoreKind: string;
   *     scoringVersion: number;
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
      const { numCorrect = 0, numAttempted = 0, numIncorrect = 0 } = subtaskScores.test ?? {};
      const percentCorrect = numAttempted > 0 ? Math.round((100 * numCorrect) / numAttempted) : 0;
      return {
        ...(this.isAdaptiveScoring() ? {} : { roarScore: numCorrect }),
        numCorrect,
        numAttempted,
        numIncorrect,
        percentCorrect,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      };
    });

    // computedScores should now have keys for lsm, fsm, and del.
    // But we also want to update the total score so we add up all of the others.
    const totalScore = _reduce(
      _omit(computedScores, [COMPOSITE_DOMAIN, PA_COMPOSITE_FOUNDATIONAL]),
      (sum, score) => sum + score.roarScore,
      0,
    );

    // Composite raw counts are the sum across the subtasks (fsm/lsm/del). These are
    // emitted for the composite group and read by the backend best-run recompute
    // (numAttempted tiebreaker under domain='composite').
    const subtaskScoresOnly = _omit(computedScores, [COMPOSITE_DOMAIN, PA_COMPOSITE_FOUNDATIONAL]);
    const compositeNumCorrect = _reduce(subtaskScoresOnly, (sum, score) => sum + (score.numCorrect ?? 0), 0);
    const compositeNumAttempted = _reduce(subtaskScoresOnly, (sum, score) => sum + (score.numAttempted ?? 0), 0);
    const compositeNumIncorrect = compositeNumAttempted - compositeNumCorrect;
    const compositePercentCorrect =
      compositeNumAttempted > 0 ? Math.round((100 * compositeNumCorrect) / compositeNumAttempted) : 0;
    computedScores[COMPOSITE_DOMAIN] = {
      ...computedScores[COMPOSITE_DOMAIN],
      numCorrect: compositeNumCorrect,
      numAttempted: compositeNumAttempted,
      numIncorrect: compositeNumIncorrect,
      percentCorrect: compositePercentCorrect,
      roarScoreKind: this.roarScoreKind,
      scoringVersion: this.scoringVersion,
    };

    const thetas = store.session.get('thetas');
    const thetaSEs = store.session.get('thetaSEs');
    if (this.isAdaptiveScoring() && thetas && thetaSEs) {
      for (const key of Object.keys(computedScores)) {
        const thetaKey = key.toLowerCase();
        const theta = store.session.get('thetas')[thetaKey];
        const thetaSE = store.session.get('thetaSEs')[thetaKey];
        // Raw = native per-subtask scale; computed = same value (no cross-scale transform per subtask).
        // Composite values are overwritten below by compositeThetas with the shared-scale estimates.
        computedScores[key].thetaEstimateRaw = theta;
        computedScores[key].thetaSERaw = thetaSE;
        computedScores[key].thetaEstimate = thetas[key.toLowerCase()];
        computedScores[key].thetaSE = thetaSEs[key.toLowerCase()];
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
        if (!this.tableLoadingPromise) {
          this.tableLoadingPromise = this.initTable();
        }

        try {
          // Subsequent calls await the same promise to avoid multiple network requests
          await this.tableLoadingPromise;
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

      // Then we find the row in the lookup table that corresponds to the total score.
      let myRow;

      if (this.isAdaptiveScoring() && thetas) {
        // Adaptive: match the age row whose thetaEstimate equals the scaled theta on the 0.1 grid.
        myRow = selectNormRow(this.lookupTable, {
          keyColumn: 'ageMonths',
          keyValue: Number(this.ageForScore),
          scoreColumn: 'thetaEstimate',
          scoreValue: store.session.get('thetas').scaled,
          matchMode: 'theta',
        });
      } else if (grade < 6) {
        // Fixed, younger grades: match by age + exact total correct (roarScore).
        myRow = selectNormRow(this.lookupTable, {
          keyColumn: 'ageMonths',
          keyValue: Number(this.ageForScore),
          scoreColumn: 'roarScore',
          scoreValue: totalScore,
          matchMode: 'exact',
        });
      } else {
        // Fixed, grade >= 6: match by grade + exact total correct (roarScore).
        myRow = selectNormRow(this.lookupTable, {
          keyColumn: 'grade',
          keyValue: grade,
          scoreColumn: 'roarScore',
          scoreValue: totalScore,
          matchMode: 'exact',
        });
      }

      if (myRow !== undefined) {
        // And add columns in the lookup table except for the age and roarScore.
        const { roarScore, ...normedScores } = _omit(myRow, ['ageMonths', 'grade']);

        computedScores.composite = {
          ...computedScores.composite,
          ...computedScores.composite_foundational,
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
