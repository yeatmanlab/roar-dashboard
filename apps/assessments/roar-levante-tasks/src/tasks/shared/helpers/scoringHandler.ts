import * as Papa from 'papaparse';
import _mapValues from 'lodash/mapValues';
import _omit from 'lodash/omit';
//@ts-ignore
import { getGrade } from '@bdelab/roar-utils';
import type { IrtEstimate } from './irtEstimates';

interface LookupRow {
  ageMonths: number;
  thetaEstimate: number;
  roarScore: number;
  standardScore: string;
  percentile: string;
}

type NormedTask = 'trog' | 'roar-inference';

interface UserMetadata {
  age?: number | string;
  grade?: number | string;
  [key: string]: any;
}

const NORMED_TASK_CONFIG: Record<NormedTask, { bucket: string; csv: string }> = {
  trog: {
    bucket: 'roar-syntax',
    csv: 'trog',
  },
  'roar-inference': {
    bucket: 'roar-inference',
    csv: 'inference',
  },
};

export class ScoringHandler {
  task: NormedTask;

  // unnormed scores
  totalCorrect: number;

  // normed scores
  lookupTable: LookupRow[];
  lookupTablePromise: Promise<LookupRow[]> | null;
  lookupTableLoaded: boolean;
  lookupTableError: Error | null;
  ageForScore: number | undefined;
  scoringVersion: number | undefined;
  irtEstimates: Record<string, IrtEstimate> | null;
  userMetadata: UserMetadata;

  constructor(task: NormedTask, scoringVersion: number | undefined, userMetadata: UserMetadata) {
    this.task = task;
    this.totalCorrect = 0;
    this.lookupTable = [];
    this.lookupTablePromise = null;
    this.lookupTableLoaded = false;
    this.lookupTableError = null;
    this.ageForScore = undefined;
    this.scoringVersion = scoringVersion;
    this.irtEstimates = null;
    this.userMetadata = userMetadata;
  }

  private getAgeForScore = ({ ageMin, ageMax }: { ageMin: number; ageMax: number }) => {
    // isNaN handles standalone params
    if (this.userMetadata?.age == undefined || isNaN(Number(this.userMetadata?.age))) {
      if (!this.userMetadata?.grade) return;
      const grade = getGrade(this.userMetadata?.grade);

      // Unable to parse grade
      // eslint-disable-next-line eqeqeq
      if (grade == undefined) return;

      this.ageForScore = 66 + Number(grade) * 12;
    } else {
      this.ageForScore = Number(this.userMetadata.age);
    }

    if (this.ageForScore < ageMin) this.ageForScore = ageMin;
    if (this.ageForScore > ageMax) this.ageForScore = ageMax;
  };

  async initTable(): Promise<LookupRow[]> {
    const { bucket, csv } = NORMED_TASK_CONFIG[this.task as NormedTask];
    const tableURL = `https://storage.googleapis.com/${bucket}/scores/${csv}_lookup_v${this.scoringVersion}.csv`;

    return new Promise((resolve, reject) => {
      Papa.parse(tableURL, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const loadedTable = results.data as LookupRow[];
          const availableAges = Array.from(new Set(loadedTable.map((row) => row.ageMonths))).sort((a, b) => a - b);
          if (availableAges.length === 0) {
            console.error('Unable to get age ranges from lookup table. Table may be empty or malformed.');
          } else {
            this.getAgeForScore({ ageMin: availableAges[0], ageMax: availableAges[availableAges.length - 1] });
          }
          this.lookupTable = loadedTable.filter((row) => row.ageMonths === this.ageForScore);
          this.lookupTableLoaded = true;
          resolve(loadedTable);
        },
        error: (err) => {
          this.lookupTablePromise = null;
          // Reset to prevent stale data on retry
          this.lookupTable = [];
          reject(err);
        },
      });
    });
  }

  private getNormedScores = async (rawScores: Record<string, any>) => {
    if (!this.lookupTableLoaded) {
      if (!this.lookupTablePromise) {
        this.lookupTablePromise = this.initTable();
      }

      try {
        // Subsequent calls await the same promise to avoid multiple network requests
        await this.lookupTablePromise;

        // Clear error on successful load
        this.lookupTableError = null;
      } catch (err) {
        // Only log when error state changes to avoid flooding logs
        const errorMessage = err instanceof Error ? err.message : String(err);
        const previousErrorMessage =
          this.lookupTableError instanceof Error ? this.lookupTableError.message : String(this.lookupTableError);
        if (previousErrorMessage !== errorMessage) {
          console.error('Error loading scoring table:', errorMessage);
          this.lookupTableError = err as Error;
        }
      }
    }

    // This returns an object with the same top-level keys as the input raw scores
    // but the values are the theta estimates. Top-level keys are defined by trial_type.
    const computedScores = _mapValues(rawScores, (subtaskScores) => {
      const thetaEstimate = subtaskScores.test?.thetaEstimate === undefined ? null : subtaskScores.test?.thetaEstimate;
      let computedScore = {
        thetaEstimate,
        scoringVersion: this.scoringVersion,
      };

      // eslint-disable-next-line eqeqeq
      if (thetaEstimate != undefined) {
        const rounded = Number(thetaEstimate.toFixed(1));

        const myRow = this.lookupTable.find((row) => Number(Number(row.thetaEstimate).toFixed(1)) === rounded);

        if (myRow !== undefined) {
          const { ageMonths, thetaEstimate, ...rest } = myRow;
          // Filter out empty keys and 'X' column that might exist in CSV
          const normedScores = Object.fromEntries(Object.entries(rest).filter(([key]) => key && key !== 'X'));

          computedScore = {
            ...computedScore,
            ...normedScores,
          };
        }
      }
      return computedScore;
    });

    // Add back missing irt estimates (e.g., composite_comprehension is not a subtask, therefore it does not have a respective raw scores object)
    Object.entries(this.irtEstimates || {}).forEach(([key, value]) => {
      computedScores[key] = {
        ...computedScores[key],
        ...value,
      };
    });

    return computedScores;
  };

  private getUnnormedScores = (rawScores: Record<string, any>) => {
    // This returns an object with the same top-level keys as the input raw scores
    // But the values are the number of correct trials, not including practice trials.
    const computedScores: any = _mapValues(rawScores, (subtaskScores) => {
      const subScore = subtaskScores.test?.numCorrect || 0;
      const subPercentCorrect = subtaskScores.test?.numCorrect / subtaskScores.test?.numAttempted || 0;

      return {
        subScore: subScore,
        subPercentCorrect: subPercentCorrect,
      };
    });

    // computedScores should now have keys for each subtask.
    // But we also want to update the total score so we add up all of the others.
    //const totalScore = _reduce(_omit(computedScores, ['composite']), (sum, score) => sum + score.subScore, 0);

    computedScores.composite = {
      totalCorrect: this.totalCorrect,
      totalNumAttempted: rawScores?.composite?.test?.numAttempted,
      totalPercentCorrect:
        rawScores?.composite?.test?.numAttempted > 0
          ? Math.round((this.totalCorrect / rawScores?.composite?.test?.numAttempted) * 100)
          : 0, // Default to 0 if numAttempted is zero
    };

    return computedScores;
  };

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
   * @param rawScores Raw scores for each subtask
   * @returns Computed scores for each subtask
   */
  computedScoreCallback = async (rawScores: Record<string, any>) => {
    // Normed scores if scoringVersion > 0
    const isNormed =
      Object.keys(NORMED_TASK_CONFIG).includes(this.task) && this.scoringVersion && this.scoringVersion > 0;

    return isNormed ? await this.getNormedScores(rawScores) : this.getUnnormedScores(rawScores);
  };
}
