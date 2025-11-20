import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setProgressChartData, setProgressChartOptions } from './plotting';
import { PROGRESS_COLORS } from '@/constants/completionStatus';

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
});
