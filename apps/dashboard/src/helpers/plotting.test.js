import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setProgressChartData,
  setProgressChartOptions,
  setDistributionChartData,
  setDistributionChartOptions,
  mapSupportLevelCounts,
  aggregateSupportLevelRuns,
} from './plotting';
import { PROGRESS_COLORS } from '@/constants/completionStatus';
import { SCORE_SUPPORT_LEVEL_COLORS, SCORE_SUPPORT_SKILL_LEVELS } from '@/constants/scores';

global.document = {
  documentElement: {},
  getComputedStyle: vi.fn(),
};

describe('plotting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('setProgressChartData', () => {
    it('should return correct chart data structure with zero values', () => {
      const orgStats = { assigned: 0, started: 0, completed: 0 };
      const chartData = setProgressChartData(orgStats);

      expect(chartData).toHaveProperty('labels');
      expect(chartData).toHaveProperty('datasets');
      expect(chartData.labels).toEqual(['']);
      expect(chartData.datasets).toHaveLength(3);

      expect(chartData.datasets[0].label).toBe('Completed');
      expect(chartData.datasets[1].label).toBe('Started');
      expect(chartData.datasets[2].label).toBe('Assigned');

      expect(chartData.datasets[0].data).toEqual([0]);
      expect(chartData.datasets[1].data).toEqual([0]);
      expect(chartData.datasets[2].data).toEqual([0]);
    });

    it('should use raw values without subtraction when stats are provided', () => {
      const orgStats = { assigned: 10, started: 5, completed: 2 };
      const chartData = setProgressChartData(orgStats);

      // Values are now used directly (backend pre-calculates net values)
      expect(chartData.datasets[0].data).toEqual([2]); // completed
      expect(chartData.datasets[1].data).toEqual([5]); // started (raw value)
      expect(chartData.datasets[2].data).toEqual([10]); // assigned (raw value)
    });

    it('should handle undefined orgStats', () => {
      const chartData = setProgressChartData(undefined);

      expect(chartData.datasets[0].data).toEqual([0]);
      expect(chartData.datasets[1].data).toEqual([0]);
      expect(chartData.datasets[2].data).toEqual([0]);
    });

    it('should use correct colors from completion status constants', () => {
      const orgStats = { assigned: 10, started: 5, completed: 2 };
      const chartData = setProgressChartData(orgStats);

      expect(chartData.datasets[0].backgroundColor).toBe(PROGRESS_COLORS.COMPLETED);
      expect(chartData.datasets[1].backgroundColor).toBe(PROGRESS_COLORS.STARTED);
      expect(chartData.datasets[2].backgroundColor).toBe(PROGRESS_COLORS.ASSIGNED);
    });
  });

  describe('setProgressChartOptions', () => {
    it('should return correct chart options structure', () => {
      const orgStats = { assigned: 10 };
      const options = setProgressChartOptions(orgStats);

      expect(options).toHaveProperty('indexAxis', 'y');
      expect(options).toHaveProperty('maintainAspectRatio', false);
      expect(options).toHaveProperty('aspectRatio', 9);
      expect(options).toHaveProperty('plugins.legend', false);
      expect(options).toHaveProperty('scales.x.stacked', true);
      expect(options).toHaveProperty('scales.y.stacked', true);
    });

    it('should set min to 0 and max to assigned value', () => {
      const orgStats = { assigned: 10 };
      const options = setProgressChartOptions(orgStats);

      expect(options.scales.x.min).toBe(0);
      expect(options.scales.x.max).toBe(10);
      expect(options.scales.y.min).toBe(0);
      expect(options.scales.y.max).toBe(10);
    });

    it('should handle undefined orgStats', () => {
      const options = setProgressChartOptions(undefined);

      expect(options.scales.x.min).toBe(0);
      expect(options.scales.x.max).toBe(0);
    });
  });

  describe('setDistributionChartData', () => {
    it('should return correct chart data structure with zero values', () => {
      const counts = { below: 0, some: 0, above: 0 };
      const chartData = setDistributionChartData(counts);

      expect(chartData).toHaveProperty('labels');
      expect(chartData).toHaveProperty('datasets');
      expect(chartData.labels).toEqual(['']);
      expect(chartData.datasets).toHaveLength(3);

      expect(chartData.datasets[0].label).toBe('Needs Extra Support');
      expect(chartData.datasets[1].label).toBe('Developing Skill');
      expect(chartData.datasets[2].label).toBe('Achieved Skill');

      expect(chartData.datasets[0].data).toEqual([0]);
      expect(chartData.datasets[1].data).toEqual([0]);
      expect(chartData.datasets[2].data).toEqual([0]);
    });

    it('should use provided support level counts as data values', () => {
      const counts = { below: 3, some: 5, above: 7 };
      const chartData = setDistributionChartData(counts);

      expect(chartData.datasets[0].data).toEqual([3]);
      expect(chartData.datasets[1].data).toEqual([5]);
      expect(chartData.datasets[2].data).toEqual([7]);
    });

    it('should handle undefined input', () => {
      const chartData = setDistributionChartData(undefined);

      expect(chartData.datasets[0].data).toEqual([0]);
      expect(chartData.datasets[1].data).toEqual([0]);
      expect(chartData.datasets[2].data).toEqual([0]);
    });

    it('should handle null input', () => {
      const chartData = setDistributionChartData(null);

      expect(chartData.datasets[0].data).toEqual([0]);
      expect(chartData.datasets[1].data).toEqual([0]);
      expect(chartData.datasets[2].data).toEqual([0]);
    });

    it('should use correct colors from score support level constants', () => {
      const counts = { below: 1, some: 1, above: 1 };
      const chartData = setDistributionChartData(counts);

      expect(chartData.datasets[0].backgroundColor).toBe(SCORE_SUPPORT_LEVEL_COLORS.BELOW);
      expect(chartData.datasets[1].backgroundColor).toBe(SCORE_SUPPORT_LEVEL_COLORS.SOME);
      expect(chartData.datasets[2].backgroundColor).toBe(SCORE_SUPPORT_LEVEL_COLORS.ABOVE);
    });

    it('should round left corners on the first non-zero segment', () => {
      const counts = { below: 0, some: 5, above: 3 };
      const chartData = setDistributionChartData(counts);

      // below is zero, so middle (some) gets left rounding
      expect(chartData.datasets[0].borderRadius.topLeft).toBe(0);
      expect(chartData.datasets[1].borderRadius.topLeft).toBe(8);
      expect(chartData.datasets[1].borderRadius.bottomLeft).toBe(8);
    });

    it('should round right corners on the last non-zero segment', () => {
      const counts = { below: 3, some: 5, above: 0 };
      const chartData = setDistributionChartData(counts);

      // above is zero, so middle (some) gets right rounding
      expect(chartData.datasets[2].borderRadius.topRight).toBe(0);
      expect(chartData.datasets[1].borderRadius.topRight).toBe(8);
      expect(chartData.datasets[1].borderRadius.bottomRight).toBe(8);
    });

    it('should round both sides of a single non-zero segment', () => {
      const counts = { below: 0, some: 0, above: 10 };
      const chartData = setDistributionChartData(counts);

      expect(chartData.datasets[2].borderRadius.topLeft).toBe(8);
      expect(chartData.datasets[2].borderRadius.bottomLeft).toBe(8);
      expect(chartData.datasets[2].borderRadius.topRight).toBe(8);
      expect(chartData.datasets[2].borderRadius.bottomRight).toBe(8);
    });

    it('should set borderSkipped to false and borderWidth to 0 for all datasets', () => {
      const counts = { below: 1, some: 2, above: 3 };
      const chartData = setDistributionChartData(counts);

      chartData.datasets.forEach((dataset) => {
        expect(dataset.borderSkipped).toBe(false);
        expect(dataset.borderWidth).toBe(0);
      });
    });
  });

  describe('setDistributionChartOptions', () => {
    it('should return correct chart options structure', () => {
      const counts = { below: 2, some: 3, above: 5 };
      const options = setDistributionChartOptions(counts);

      expect(options).toHaveProperty('indexAxis', 'y');
      expect(options).toHaveProperty('maintainAspectRatio', false);
      expect(options).toHaveProperty('aspectRatio', 9);
      expect(options).toHaveProperty('plugins.legend', false);
      expect(options).toHaveProperty('scales.x.stacked', true);
      expect(options).toHaveProperty('scales.y.stacked', true);
    });

    it('should set min to 0 and max to the total of all counts', () => {
      const counts = { below: 2, some: 3, above: 5 };
      const options = setDistributionChartOptions(counts);

      expect(options.scales.x.min).toBe(0);
      expect(options.scales.x.max).toBe(10);
      expect(options.scales.y.min).toBe(0);
      expect(options.scales.y.max).toBe(10);
    });

    it('should handle undefined input', () => {
      const options = setDistributionChartOptions(undefined);

      expect(options.scales.x.min).toBe(0);
      expect(options.scales.x.max).toBe(0);
    });

    it('should handle null input', () => {
      const options = setDistributionChartOptions(null);

      expect(options.scales.x.min).toBe(0);
      expect(options.scales.x.max).toBe(0);
    });

    it('should hide ticks, grid, and border on both axes', () => {
      const counts = { below: 1, some: 1, above: 1 };
      const options = setDistributionChartOptions(counts);

      for (const axis of ['x', 'y']) {
        expect(options.scales[axis].ticks.display).toBe(false);
        expect(options.scales[axis].grid.display).toBe(false);
        expect(options.scales[axis].border.display).toBe(false);
      }
    });

    describe('tooltip callbacks', () => {
      it('should include percentage in the tooltip label', () => {
        const counts = { below: 1, some: 1, above: 1 };
        const options = setDistributionChartOptions(counts);
        const labelFn = options.plugins.tooltip.callbacks.label;

        const context = { dataset: { label: 'Needs Extra Support' }, parsed: { x: 1 } };
        const result = labelFn(context);

        expect(result).toBe('Needs Extra Support: 1 (33%)');
      });

      it('should show 100% when only one category has values', () => {
        const counts = { below: 0, some: 0, above: 5 };
        const options = setDistributionChartOptions(counts);
        const labelFn = options.plugins.tooltip.callbacks.label;

        const context = { dataset: { label: 'Achieved Skill' }, parsed: { x: 5 } };
        const result = labelFn(context);

        expect(result).toBe('Achieved Skill: 5 (100%)');
      });

      it('should show 0% for a zero-value segment', () => {
        const counts = { below: 0, some: 3, above: 7 };
        const options = setDistributionChartOptions(counts);
        const labelFn = options.plugins.tooltip.callbacks.label;

        const context = { dataset: { label: 'Needs Extra Support' }, parsed: { x: 0 } };
        const result = labelFn(context);

        expect(result).toBe('Needs Extra Support: 0 (0%)');
      });

      it('should handle all-zero counts without dividing by zero', () => {
        const counts = { below: 0, some: 0, above: 0 };
        const options = setDistributionChartOptions(counts);
        const labelFn = options.plugins.tooltip.callbacks.label;

        const context = { dataset: { label: 'Developing Skill' }, parsed: { x: 0 } };
        const result = labelFn(context);

        expect(result).toBe('Developing Skill: 0 (0%)');
      });

      it('should round percentage to nearest integer', () => {
        const counts = { below: 1, some: 1, above: 1 };
        const options = setDistributionChartOptions(counts);
        const labelFn = options.plugins.tooltip.callbacks.label;

        // 1/3 = 33.33...% → rounds to 33%
        const context = { dataset: { label: 'Developing Skill' }, parsed: { x: 1 } };
        const result = labelFn(context);

        expect(result).toContain('33%');
      });
    });
  });

  describe('mapSupportLevelCounts', () => {
    it('maps the score-overview support-level names onto the chart vocabulary', () => {
      const supportLevels = {
        needsExtraSupport: { count: 3 },
        developingSkill: { count: 5 },
        achievedSkill: { count: 7 },
      };

      expect(mapSupportLevelCounts(supportLevels)).toEqual({ below: 3, some: 5, above: 7 });
    });

    it('zeroes a task the endpoint returned no entry for', () => {
      expect(mapSupportLevelCounts(undefined)).toEqual({ below: 0, some: 0, above: 0 });
      expect(mapSupportLevelCounts(null)).toEqual({ below: 0, some: 0, above: 0 });
    });

    it('zeroes individual levels that are absent', () => {
      expect(mapSupportLevelCounts({ developingSkill: { count: 2 } })).toEqual({
        below: 0,
        some: 2,
        above: 0,
      });
    });

    it('preserves a zero count rather than coercing it away', () => {
      const supportLevels = {
        needsExtraSupport: { count: 0 },
        developingSkill: { count: 0 },
        achievedSkill: { count: 4 },
      };

      expect(mapSupportLevelCounts(supportLevels)).toEqual({ below: 0, some: 0, above: 4 });
    });
  });

  describe('aggregateSupportLevelRuns', () => {
    it('returns null when there are no runs', () => {
      expect(aggregateSupportLevelRuns(null)).toBeNull();
      expect(aggregateSupportLevelRuns(undefined)).toBeNull();
    });

    it('counts an array of runs by support level', () => {
      const runs = [
        { scores: { support_level: SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT } },
        { scores: { support_level: SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT } },
        { scores: { support_level: SCORE_SUPPORT_SKILL_LEVELS.DEVELOPING_SKILL } },
        { scores: { support_level: SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL } },
      ];

      expect(aggregateSupportLevelRuns(runs)).toEqual({ below: 2, some: 1, above: 1 });
    });

    it('skips runs with an absent or unrecognized support level', () => {
      // Only classified runs count toward the distribution, matching the prior
      // client-side aggregation — an unscored run must not inflate any bucket.
      const runs = [
        { scores: { support_level: SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL } },
        { scores: { support_level: null } },
        { scores: { support_level: 'Optional' } },
        { scores: {} },
        {},
      ];

      expect(aggregateSupportLevelRuns(runs)).toEqual({ below: 0, some: 0, above: 1 });
    });

    it('returns zeroes for an empty runs array', () => {
      expect(aggregateSupportLevelRuns([])).toEqual({ below: 0, some: 0, above: 0 });
    });

    it('reads pre-aggregated district totals without iterating', () => {
      const districtTotals = { below: { total: 4 }, some: { total: 5 }, above: { total: 6 } };

      expect(aggregateSupportLevelRuns(districtTotals)).toEqual({ below: 4, some: 5, above: 6 });
    });

    it('zeroes district totals that are absent', () => {
      expect(aggregateSupportLevelRuns({ some: { total: 2 } })).toEqual({
        below: 0,
        some: 2,
        above: 0,
      });
    });
  });
});
