import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setBarChartData, setBarChartOptions } from './plotting';

global.document = {
  documentElement: {},
  getComputedStyle: vi.fn(),
};

describe('plotting', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    document.documentElement.style = {};
    const mockGetComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: vi.fn((property) => {
        const colors = {
          '--bright-green': '#00FF00',
          '--yellow-100': '#FFFF00',
          '--surface-d': '#DDDDDD',
        };
        return colors[property] || '';
      }),
    });

    document.getComputedStyle = mockGetComputedStyle;
    global.getComputedStyle = mockGetComputedStyle;
  });

  describe('setBarChartData', () => {
    it('should return correct chart data structure with zero values', () => {
      const orgStats = { assigned: 0, started: 0, completed: 0 };
      const chartData = setBarChartData(orgStats);

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

    it('should calculate correct values when stats are provided', () => {
      const orgStats = { assigned: 10, started: 5, completed: 2 };
      const chartData = setBarChartData(orgStats);

      expect(chartData.datasets[0].data).toEqual([2]);

      expect(chartData.datasets[1].data).toEqual([3]); // 5 - 2

      expect(chartData.datasets[2].data).toEqual([5]); // 10 - (3 + 2)
    });

    it('should handle undefined orgStats', () => {
      const chartData = setBarChartData(undefined);

      expect(chartData.datasets[0].data).toEqual([0]);
      expect(chartData.datasets[1].data).toEqual([0]);
      expect(chartData.datasets[2].data).toEqual([0]);
    });

    it('should use correct colors from CSS variables', () => {
      const orgStats = { assigned: 10, started: 5, completed: 2 };
      const chartData = setBarChartData(orgStats);

      expect(chartData.datasets[0].backgroundColor).toBe('#00FF00');
      expect(chartData.datasets[1].backgroundColor).toBe('#FFFF00');
      expect(chartData.datasets[2].backgroundColor).toBe('#DDDDDD');
    });
  });

  describe('setBarChartOptions', () => {
    it('should return correct chart options structure', () => {
      const orgStats = { assigned: 10 };
      const options = setBarChartOptions(orgStats);

      expect(options).toHaveProperty('indexAxis', 'y');
      expect(options).toHaveProperty('maintainAspectRatio', false);
      expect(options).toHaveProperty('aspectRatio', 9);
      expect(options).toHaveProperty('plugins.legend', false);
      expect(options).toHaveProperty('scales.x.stacked', true);
      expect(options).toHaveProperty('scales.y.stacked', true);
    });

    it('should set min to 0 and max to assigned value', () => {
      const orgStats = { assigned: 10 };
      const options = setBarChartOptions(orgStats);

      expect(options.scales.x.min).toBe(0);
      expect(options.scales.x.max).toBe(10);
      expect(options.scales.y.min).toBe(0);
      expect(options.scales.y.max).toBe(10);
    });

    it('should handle undefined orgStats', () => {
      const options = setBarChartOptions(undefined);

      expect(options.scales.x.min).toBe(0);
      expect(options.scales.x.max).toBe(0);
    });
  });
});
