import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLongitudinalSeries } from './useLongitudinalSeries';
import { getDialColor } from '@/helpers/reports';

// Mock the reports helpers
vi.mock('@/helpers/reports', () => ({
  getDialColor: vi.fn(),
}));

describe('useLongitudinalSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDialColor.mockReturnValue('#3b82f6'); // blue-500
  });

  describe('series data processing', () => {
    it('should sort longitudinal data by date', () => {
      const props = {
        longitudinalData: [
          { date: '2024-03-01', scores: { rawScore: 10 }, assignmentId: 'a3' },
          { date: '2024-01-01', scores: { rawScore: 5 }, assignmentId: 'a1' },
          { date: '2024-02-01', scores: { rawScore: 8 }, assignmentId: 'a2' },
        ],
        studentGrade: 3,
        taskId: 'test-task',
        currentAssignmentId: 'a3',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value).toHaveLength(3);
      expect(series.value[0].y).toBe(5);
      expect(series.value[1].y).toBe(8);
      expect(series.value[2].y).toBe(10);
    });

    it('should prefer rawScore over other score types', () => {
      const props = {
        longitudinalData: [
          { date: '2024-01-01', scores: { rawScore: 10, percentile: 50, standardScore: 100 }, assignmentId: 'a1' },
        ],
        studentGrade: 3,
        taskId: 'test-task',
        currentAssignmentId: 'a1',
      };

      const { series, seriesLabel } = useLongitudinalSeries(props);

      expect(series.value).toHaveLength(1);
      expect(series.value[0].y).toBe(10);
      expect(seriesLabel.value).toBe('Raw Score');
    });

    it('should use percentile if rawScore is not available', () => {
      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { percentile: 75, standardScore: 110 } }],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series, seriesLabel } = useLongitudinalSeries(props);

      expect(series.value).toHaveLength(1);
      expect(series.value[0].y).toBe(75);
      expect(seriesLabel.value).toBe('Percentile');
    });

    it('should use standardScore if rawScore and percentile are not available', () => {
      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { standardScore: 105 } }],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series, seriesLabel } = useLongitudinalSeries(props);

      expect(series.value).toHaveLength(1);
      expect(series.value[0].y).toBe(105);
      expect(seriesLabel.value).toBe('Standard Score');
    });

    it('should filter out entries with NaN scores', () => {
      const props = {
        longitudinalData: [
          { date: '2024-01-01', scores: { rawScore: 10 } },
          { date: '2024-02-01', scores: { rawScore: NaN } },
          { date: '2024-03-01', scores: { rawScore: 15 } },
        ],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value).toHaveLength(2);
      expect(series.value[0].y).toBe(10);
      expect(series.value[1].y).toBe(15);
    });

    it('should filter out entries with null scores', () => {
      const props = {
        longitudinalData: [
          { date: '2024-01-01', scores: { rawScore: 10 } },
          { date: '2024-02-01', scores: { rawScore: null } },
          { date: '2024-03-01', scores: { rawScore: 15 } },
        ],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value).toHaveLength(2);
    });

    it('should filter out entries with undefined scores', () => {
      const props = {
        longitudinalData: [
          { date: '2024-01-01', scores: { rawScore: 10 } },
          { date: '2024-02-01', scores: {} },
          { date: '2024-03-01', scores: { rawScore: 15 } },
        ],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value).toHaveLength(2);
    });
  });

  describe('color assignment', () => {
    it('should use dial color when available', () => {
      getDialColor.mockReturnValue('#3b82f6'); // blue-500

      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 10, percentile: 25 } }],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value[0].color).toBe('#3b82f6'); // blue-500
    });

    it('should use default score type color when dial color is not available', () => {
      getDialColor.mockReturnValue(null);

      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 10 } }],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value[0].color).toBe('#3b82f6'); // blue-500 (default color)
    });

    it('should call getDialColor with correct parameters', () => {
      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 10, percentile: 50 } }],
        studentGrade: 5,
        taskId: 'swr',
      };

      const { series } = useLongitudinalSeries(props);

      series.value;

      expect(getDialColor).toHaveBeenCalledWith(5, 50, 10, 'swr');
    });
  });

  describe('series metadata', () => {
    it('should include percentile and standardScore in series data', () => {
      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 10, percentile: 60, standardScore: 95 } }],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value[0].percentile).toBe(60);
      expect(series.value[0].standardScore).toBe(95);
    });

    it('should set percentile and standardScore to undefined when not available', () => {
      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 10 } }],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value[0].percentile).toBeUndefined();
      expect(series.value[0].standardScore).toBeUndefined();
    });

    it('should set correct seriesStroke color based on chosen type', () => {
      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 10 } }],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { seriesStroke } = useLongitudinalSeries(props);

      expect(seriesStroke.value).toBe('#3b82f6'); // blue-500
    });
  });

  describe('domain calculations', () => {
    it('should calculate correct x domain from series dates', () => {
      const props = {
        longitudinalData: [
          { date: '2024-01-01', scores: { rawScore: 10 } },
          { date: '2024-03-01', scores: { rawScore: 15 } },
          { date: '2024-02-01', scores: { rawScore: 12 } },
        ],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { xDomain } = useLongitudinalSeries(props);

      expect(xDomain.value[0]).toEqual(new Date('2024-01-01'));
      expect(xDomain.value[1]).toEqual(new Date('2024-03-01'));
    });

    it('should handle single value y domain', () => {
      const props = {
        longitudinalData: [{ date: '2024-01-01', scores: { rawScore: 10 }, assignmentId: 'a1' }],
        studentGrade: 3,
        taskId: 'test-task',
        currentAssignmentId: 'a1',
      };

      const { yDomain } = useLongitudinalSeries(props);

      expect(yDomain.value[0]).toBe(0);
      expect(yDomain.value[1]).toBe(10); // When there's only one value, max stays the same
    });

    it('should return default domains when no series data', () => {
      const props = {
        longitudinalData: [],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { xDomain, yDomain } = useLongitudinalSeries(props);

      expect(xDomain.value).toHaveLength(2);
      expect(xDomain.value[0]).toBeInstanceOf(Date);
      expect(xDomain.value[1]).toBeInstanceOf(Date);
      expect(yDomain.value).toEqual([0, 1]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty longitudinalData', () => {
      const props = {
        longitudinalData: [],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value).toEqual([]);
    });

    it('should handle null longitudinalData', () => {
      const props = {
        longitudinalData: null,
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value).toEqual([]);
    });

    it('should handle undefined longitudinalData', () => {
      const props = {
        longitudinalData: undefined,
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value).toEqual([]);
    });

    it('should handle entries with missing scores object', () => {
      const props = {
        longitudinalData: [
          { date: '2024-01-01', scores: { rawScore: 10 } },
          { date: '2024-02-01' }, // Missing scores
          { date: '2024-03-01', scores: { rawScore: 15 } },
        ],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value).toHaveLength(2);
    });

    it('should convert dates to Date objects', () => {
      const props = {
        longitudinalData: [{ date: '2024-01-15T10:30:00Z', scores: { rawScore: 10 } }],
        studentGrade: 3,
        taskId: 'test-task',
      };

      const { series } = useLongitudinalSeries(props);

      expect(series.value[0].x).toBeInstanceOf(Date);
    });
  });
});
