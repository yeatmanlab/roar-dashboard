/* eslint-disable import/prefer-default-export */
import _fromPairs from 'lodash/fromPairs';
import _omit from 'lodash/omit';
import _toPairs from 'lodash/toPairs';
import * as Papa from 'papaparse';
import store from 'store2';
import { getGrade } from '@bdelab/roar-utils';

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

  const ageMin = 72;
  const ageMax = scoringVersion === 3 && taskId === 'sre' ? 180 : 216;

  if (ageMonths < ageMin) ageMonths = ageMin;
  if (ageMonths > ageMax) ageMonths = ageMax;
  // Clamp grade to [1, 12] for v3 SRE if < 1 or > 12. Otherwise, leave it unchanged.
  if (grade != undefined && taskId === 'sre' && scoringVersion === 3) grade = Math.min(12, Math.max(1, grade));

  return {
    ageMonths,
    grade,
  };
};

const isValidForScoring = ({ ageMonths, grade, scoringVersion, taskId }) => {
  if (scoringVersion === 3 && taskId === 'sre') {
    // For v3, we only need the grade. It should not be null or undefined.
    // eslint-disable-next-line eqeqeq
    return grade != undefined;
  }

  if (scoringVersion === 4 || taskId === 'sre-es') {
    // For sre v4 & sre-es v1, we need the age, or we can estimate the age from the grade
    // eslint-disable-next-line eqeqeq
    return ageMonths != undefined || grade != undefined;
  }

  throw new Error('Invalid scoring version');
};

const useGradeForScoring = ({ scoringVersion, taskId }) => scoringVersion === 3 && taskId === 'sre';

const useAgeForScoring = ({ scoringVersion, taskId }) => scoringVersion !== 3 || taskId === 'sre-es';

export class RoarScores {
  constructor() {
    this.scoringVersion = store.session.get('config').scoringVersion;
    this.taskId = store.session.get('config').taskId;
    this.useAgeForScoring = useAgeForScoring({ scoringVersion: this.scoringVersion, taskId: this.taskId });
    this.useGradeForScoring = useGradeForScoring({ scoringVersion: this.scoringVersion, taskId: this.taskId });
    const formattedTaskId = this.taskId.replace('-', '_');
    this.tableURL = `https://storage.googleapis.com/roar-sre/scores/${formattedTaskId}_lookup_v${this.scoringVersion}.csv`;
    this.aiTableURL = 'https://storage.googleapis.com/roar-sre/scores/sre_parallel_equating_lookup.csv';
    this.fixedFormEquatingTableURL =
      'https://storage.googleapis.com/roar-sre/scores/sre_parallel_90s_form_equating_lookup.csv';
    this.lookupTable = [];
    this.aiLookupTable = []; // loading in the AI table — could be an easier way to do this?
    this.fixedFormEquatingLookupTable = [];
    this.tableLoaded = false; // wanted to leave original tables in tact
    this.aiTableLoaded = false;
    this.fixedFormEquatingTableLoaded = false;
    this.isValidForScoring = undefined;
    this.tableLoadingPromise = null;
    this.aiTableLoadingPromise = null;
    this.initTablePromise = null;
    this.tableLoadingError = null;
    this.fixedFormEquatingTablePromise = null;
    this.fixedFormEquatingTableLoadingError = null;
  }

  async initTable() {
    const { ageMonths, grade } = getGradeAndAgeForScoring(this.scoringVersion);

    if (this.isValidForScoring === undefined) {
      this.isValidForScoring = isValidForScoring({
        ageMonths,
        grade,
        scoringVersion: this.scoringVersion,
        taskId: this.taskId,
      });
    }

    if (!this.isValidForScoring) {
      throw new Error('Invalid age or grade for scoring');
    }

    this.ageForScore = ageMonths;
    this.gradeForScore = grade;

    // Only create main table promise if not already loaded or loading
    if (!this.tableLoaded && !this.tableLoadingPromise) {
      this.tableLoadingPromise = new Promise((resolve, reject) => {
        Papa.parse(this.tableURL, {
          download: true,
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          step: (row) => {
            if (this.useGradeForScoring && this.gradeForScore === Number(row.data.grade)) {
              // In v3 we only have grade-based tables, so match the row based on the user's grade
              this.lookupTable.push(_omit(row.data, ['', 'X']));
            } else if (this.useAgeForScoring && this.ageForScore === Number(row.data.ageMonths)) {
              // In v4 we have to match age in the lookup table
              this.lookupTable.push(_omit(row.data, ['', 'X']));
            }
          },
          complete: () => {
            this.tableLoaded = true;
            resolve();
          },
          error: (error) => {
            this.tableLoadingPromise = null;
            // Reset to prevent stale data on retry
            this.lookupTable = [];
            reject(new Error(`Failed to load main lookup table: ${error.message}`));
          },
        });
      });
    }

    // Only create AI table promise if not already loaded or loading
    if (!this.aiTableLoaded && !this.aiTableLoadingPromise && this.taskId === 'sre') {
      this.aiTableLoadingPromise = new Promise((resolve, reject) => {
        Papa.parse(this.aiTableURL, {
          download: true,
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          step: (row) => {
            this.aiLookupTable.push(_omit(row.data, ['', 'X']));
          },
          complete: () => {
            this.aiTableLoaded = true;
            resolve();
          },
          error: (error) => {
            this.aiTableLoadingPromise = null;
            // Reset to prevent stale data on retry
            this.aiLookupTable = [];
            reject(new Error(`Failed to load AI lookup table: ${error.message}`));
          },
        });
      });
    }

    // Wait for whichever tables are currently loading
    const promises = [];
    if (this.tableLoadingPromise) promises.push(this.tableLoadingPromise);
    if (this.aiTableLoadingPromise) promises.push(this.aiTableLoadingPromise);

    if (promises.length > 0) {
      const results = await Promise.allSettled(promises);

      // Promise.allSettled returns an array of objects with status and value/reason
      const failures = results.filter((r) => r.status === 'rejected');

      // If all failed, throw so the catch block handles it
      if (failures.length === results.length) {
        throw failures[0].reason;
      }

      // If some (but not all) failed, log which ones
      // Only log when error state changes to avoid flooding logs
      if (failures.length > 0 && failures.length < results.length) {
        const errorMessage = failures.map((f) => f.reason?.message || f.reason).join(', ');
        if (this.tableLoadingError?.message !== errorMessage) {
          console.error('Failed tables:', failures);
          this.tableLoadingError = { message: errorMessage };
        }
      }
    }
  }

  /**
   * Loads the 90s -> 180s fixed-form equating table.
   * Rejects on parse errors or empty tables.
   * @returns {Promise<void>}
   */
  async initFixedFormEquatingTable() {
    return new Promise((resolve, reject) => {
      Papa.parse(this.fixedFormEquatingTableURL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        step: (row) => {
          this.fixedFormEquatingLookupTable.push(_omit(row.data, ['', 'X']));
        },
        complete: () => {
          if (this.fixedFormEquatingLookupTable.length === 0) {
            reject(new Error(`No fixed-form equating rows loaded from ${this.fixedFormEquatingTableURL}.`));
            return;
          }
          this.fixedFormEquatingTableLoaded = true;
          resolve();
        },
        error: (error) => {
          this.fixedFormEquatingTablePromise = null;
          // Reset to prevent stale data on retry
          this.fixedFormEquatingLookupTable = [];
          reject(new Error(`Failed to load fixed form equating table: ${error.message}`));
        },
      });
    });
  }

  /**
   * Gets the lookup row after clamping raw score to the form range.
   * Throws on missing form/score rows.
   * @param {string} form
   * @param {number} rawSreScore
   * @returns {*}
   */
  getFixedFormEquatingLookupRow(form, rawSreScore) {
    const formRows = this.fixedFormEquatingLookupTable.filter((row) => row.form === form);
    if (formRows.length === 0) {
      throw new Error(`Missing fixed-form equating lookup rows for form "${form}".`);
    }

    const rawScore = Math.max(rawSreScore || 0, 0);
    const rawScores = formRows.map((row) => row.rawScore);
    const minRawScore = Math.min(...rawScores);
    const maxRawScore = Math.max(...rawScores);
    const clampedRawScore = Math.min(Math.max(rawScore, minRawScore), maxRawScore);

    if (clampedRawScore !== rawScore) {
      // eslint-disable-next-line no-console
      console.warn(
        `Fixed-form raw score ${rawScore} for form "${form}" is outside the lookup range ` +
          `[${minRawScore}, ${maxRawScore}]. Using ${clampedRawScore}.`,
      );
    }

    const lookupRow = formRows.find((row) => row.rawScore === clampedRawScore);
    if (lookupRow === undefined) {
      throw new Error(`Missing fixed-form equating lookup row for form "${form}" and rawScore ${clampedRawScore}.`);
    }

    return lookupRow;
  }

  /**
   * Averages lookup-equated fixed-form scores.
   * The fixedForm* subscores remain raw; only the composite is equated.
   * Missing lookup rows throw via getFixedFormEquatingLookupRow.
   * @param {*} score fixedForm* sreScores are raw scores.
   * @returns {number}
   */
  getFixedFormEquatedScore(score) {
    const fixedFormScores = _toPairs(score)
      .filter(([subTask]) => subTask.startsWith('fixedForm'))
      .map(([form, formScore]) => {
        if (formScore.sreScore === undefined) {
          throw new Error(`Missing fixed-form score for form "${form}".`);
        }
        return this.getFixedFormEquatingLookupRow(form, formScore.sreScore).sreScore;
      });

    if (fixedFormScores.length === 0) return 0;

    const totalScore = fixedFormScores.reduce((acc, sreScore) => acc + sreScore, 0);
    // Intentional scoring rule: round fractional fixed-form averages up.
    return Math.ceil(totalScore / fixedFormScores.length);
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
   * The returned computed scores must have that same top-level keys as the
   * input raw scores, and each value must be an object with arbitrary computed
   * scores.  For example, one might return the SRE score (i.e., total correct
   * minus the total incorrect), a predicted TOSREC standard score, and a
   * predicted TOSREC percentile.
   *
   * {
   *   practice: {
   *    sreScore: w;
   *   },
   *   ai: {
   *     sreScore: x;
   *   },
   *   lab: {
   *     sreScore: y;
   *   },
   *   tosrec: {
   *     sreScore: z;
   *   },
   *   composite: {
   *     sreScore: y;
   *     tosrecSS: number;
   *     tosrecPercentile: number;
   *   }
   * }
   *
   * For 90s2BlocksFixedForms, fixed-form subscores remain raw and only the
   * composite score is equated:
   *
   * {
   *   fixedForm1: {
   *     sreScore: rawScore1;
   *   },
   *   fixedForm2: {
   *     sreScore: rawScore2;
   *   },
   *   composite: {
   *     sreScore: Math.ceil((equated(rawScore1) + equated(rawScore2))/2);
   *   }
   * }
   *
   * @param {*} rawScores
   * @returns {*} computedScores
   */

  computedScoreCallback = async (rawScores) => {
    const { taskId, userMode } = store.session.get('config');

    if (!['sre', 'sre-es'].includes(taskId)) return null;

    if (taskId === 'sre' && userMode === '90s2BlocksFixedForms' && !this.fixedFormEquatingTableLoaded) {
      if (!this.fixedFormEquatingTablePromise) {
        this.fixedFormEquatingTablePromise = this.initFixedFormEquatingTable();
      }

      try {
        await this.fixedFormEquatingTablePromise;
        // clear error once table is loaded
        this.fixedFormEquatingTableLoadingError = null;
      } catch (error) {
        // Only log when error state changes to avoid flooding logs
        const errorMessage = error?.message || error;
        const previousErrorMessage =
          this.fixedFormEquatingTableLoadingError?.message || this.fixedFormEquatingTableLoadingError;
        if (previousErrorMessage !== errorMessage) {
          console.error('Error loading fixed form equating table:', errorMessage);
          this.fixedFormEquatingTableLoadingError = error;
        }
      }
    }

    // This returns an object with the same top-level keys as the input raw scores
    // But the values are the number of correct trials minus the number of
    // incorrect trials, not including practice trials.
    const computedScores = _fromPairs(
      _toPairs(rawScores).map(([subTask, subScore]) => {
        // For the "practice" subtask, we want to use the raw scores associated
        // with the "practice" assessment stage. For all others, we want to use the
        // "test" assessment stage.
        const scoringStage = subTask === 'practice' ? 'practice' : 'test';
        const numCorrect = subScore[scoringStage]?.numCorrect || 0;
        const numIncorrect = subScore[scoringStage]?.numIncorrect || 0;
        const sreScore = numCorrect - numIncorrect;
        return [subTask, { sreScore }];
      }),
    );

    // this function is to compute the composite score based on corpus (fitting a linear model)
    const computedScoreConversion = (score) => {
      if (this.taskId === 'sre') {
        // For fixed 90s forms, keep fixedForm* scores raw and equate only the composite score.
        if (userMode === '90s2BlocksFixedForms') {
          return this.getFixedFormEquatedScore(score);
        }

        // For English, we use the "lab" corpus score as the composite score if it available.
        if (score.lab?.sreScore) {
          return Math.max(score.lab.sreScore, 0);
        }

        // Otherwise, we use the AI corpus equating table to convert the AI score to a composite score.
        // adjusting the ai scores to equate to the lab scores
        if (score.aiV1P1?.sreScore) {
          const rawScore = Math.max(score.aiV1P1.sreScore, 0);
          const aiRow = this.aiLookupTable.find((row) => row.rawScore === rawScore && row.form === 'aiP1');
          return aiRow.sreScore;
        }
        if (score.aiV1P2?.sreScore) {
          const rawScore = Math.max(score.aiV1P2.sreScore, 0);
          const aiRow = this.aiLookupTable.find((row) => row.rawScore === rawScore && row.form === 'aiP2');
          return aiRow.sreScore;
        }
      } else if (this.taskId === 'sre-es') {
        // For Spanish, we omit the practice and composite subtasks and take the sum of the sreScores
        const nonPracticeScores = _omit(score, ['practice', 'composite']);
        const sum = Object.values(nonPracticeScores).reduce((acc, val) => acc + (val.sreScore || 0), 0);
        return Math.max(sum, 0);
      }
      return 0;
    };

    const isNormed = this.taskId === 'sre' || (this.taskId === 'sre-es' && this.scoringVersion >= 1);

    if (isNormed && this.isValidForScoring === undefined) {
      const { ageMonths, grade } = getGradeAndAgeForScoring(this.scoringVersion);
      this.isValidForScoring = isValidForScoring({
        ageMonths,
        grade,
        scoringVersion: this.scoringVersion,
        taskId: this.taskId,
      });
    }

    if (isNormed && this.isValidForScoring) {
      if (!this.tableLoaded || !this.aiTableLoaded) {
        if (!this.initTablePromise) {
          this.initTablePromise = this.initTable();
        }

        try {
          await this.initTablePromise;
          // If tables still haven't loaded, clear the promise so it can be retried
          if (!this.tableLoaded || !this.aiTableLoaded) {
            this.initTablePromise = null;
          }
        } catch (error) {
          // Only log when error state changes to avoid flooding logs
          this.initTablePromise = null;
          const errorMessage = error?.message || error;
          const previousErrorMessage = this.tableLoadingError?.message || this.tableLoadingError;
          if (previousErrorMessage !== errorMessage) {
            console.error('Error loading scoring table:', errorMessage);
            this.tableLoadingError = error;
          }
        }
      }
    }

    // Now compute composite score after tables are loaded (so AI equating works)
    let compositeScore;
    try {
      compositeScore = computedScoreConversion(computedScores);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Composite score conversion failed; writing raw scores only:', error?.message || error);
    }
    if (compositeScore != null) {
      computedScores.composite = { sreScore: compositeScore };
    }

    if (isNormed && this.isValidForScoring) {
      // Then we find the row in the lookup table that corresponds to the composite score.
      const myRow = this.lookupTable.find((row) => row.sreScore === compositeScore);

      if (myRow !== undefined) {
        // And add columns in the lookup table except for the grade and sreScore.
        const { grade, ageMonths, sreScore, ...normedScores } = myRow;

        computedScores.composite = {
          sreScore: compositeScore,
          ...normedScores,
          scoringVersion: this.scoringVersion,
        };
      }
    }
    return computedScores;
  };
}
