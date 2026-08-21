/**
 * Ensures the FDW foreign table definitions stay in sync with their source
 * tables in the assessment database. If a column is added to or removed from
 * app.runs or app.run_scores, these tests will fail as a reminder to update
 * the corresponding FDW schema definition.
 */
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { runs } from '../assessment/runs';
import { runScores } from '../assessment/run-scores';
import { fdwRuns } from './runs';
import { fdwRunScores } from './run-scores';

/**
 * Columns intentionally excluded from the FDW definition.
 * Each entry documents why the column is not exposed over FDW.
 */
const EXCLUDED_RUN_COLUMNS: Record<string, string> = {};

const EXCLUDED_RUN_SCORE_COLUMNS: Record<string, string> = {};

function getColumnNames(table: Parameters<typeof getTableColumns>[0]): Set<string> {
  return new Set(Object.keys(getTableColumns(table)));
}

describe('FDW schema sync', () => {
  describe('runs', () => {
    const sourceColumns = getColumnNames(runs);
    const fdwColumns = getColumnNames(fdwRuns);
    const expectedFdwColumns = new Set([...sourceColumns].filter((col) => !EXCLUDED_RUN_COLUMNS[col]));

    it('FDW definition includes all non-excluded source columns', () => {
      const missing = [...expectedFdwColumns].filter((col) => !fdwColumns.has(col));
      expect(
        missing,
        `Columns in app.runs missing from FDW definition. Add them to fdwRuns or to EXCLUDED_RUN_COLUMNS with a reason.`,
      ).toEqual([]);
    });

    it('FDW definition does not include unknown extra columns', () => {
      const extra = [...fdwColumns].filter((col) => !sourceColumns.has(col));
      expect(
        extra,
        `Columns in fdwRuns that don't exist in app.runs. Remove them or update the source schema.`,
      ).toEqual([]);
    });

    it('excluded columns are documented', () => {
      for (const [col, reason] of Object.entries(EXCLUDED_RUN_COLUMNS)) {
        expect(reason.length, `EXCLUDED_RUN_COLUMNS['${col}'] needs a reason`).toBeGreaterThan(0);
        expect(sourceColumns.has(col), `EXCLUDED_RUN_COLUMNS['${col}'] doesn't exist in source — remove it`).toBe(true);
      }
    });
  });

  describe('run_scores', () => {
    const sourceColumns = getColumnNames(runScores);
    const fdwColumns = getColumnNames(fdwRunScores);
    const expectedFdwColumns = new Set([...sourceColumns].filter((col) => !EXCLUDED_RUN_SCORE_COLUMNS[col]));

    it('FDW definition includes all non-excluded source columns', () => {
      const missing = [...expectedFdwColumns].filter((col) => !fdwColumns.has(col));
      expect(
        missing,
        `Columns in app.run_scores missing from FDW definition. Add them to fdwRunScores or to EXCLUDED_RUN_SCORE_COLUMNS with a reason.`,
      ).toEqual([]);
    });

    it('FDW definition does not include unknown extra columns', () => {
      const extra = [...fdwColumns].filter((col) => !sourceColumns.has(col));
      expect(
        extra,
        `Columns in fdwRunScores that don't exist in app.run_scores. Remove them or update the source schema.`,
      ).toEqual([]);
    });

    it('excluded columns are documented', () => {
      for (const [col, reason] of Object.entries(EXCLUDED_RUN_SCORE_COLUMNS)) {
        expect(reason.length, `EXCLUDED_RUN_SCORE_COLUMNS['${col}'] needs a reason`).toBeGreaterThan(0);
        expect(sourceColumns.has(col), `EXCLUDED_RUN_SCORE_COLUMNS['${col}'] doesn't exist in source — remove it`).toBe(
          true,
        );
      }
    });
  });
});
