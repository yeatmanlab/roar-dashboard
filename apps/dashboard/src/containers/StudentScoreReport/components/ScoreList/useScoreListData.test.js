import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useScoreListData } from './useScoreListData';
import ScoreReportService from '@/services/ScoreReport.service';
import { SCORE_TYPES } from '@/constants/scores';
import { getScoreValue } from '@/helpers/reports';
import { getStudentGradeLevel } from '@/helpers/getStudentGradeLevel';

// Mock dependencies
vi.mock('@/services/ScoreReport.service', () => ({
  default: {
    processTaskScores: vi.fn(),
    getPercentileSuffixTemplate: vi.fn(),
    getScoreDescription: vi.fn(),
    getScoresArrayForTask: vi.fn(),
  },
}));

vi.mock('@/helpers/reports', () => ({
  getScoreValue: vi.fn(),
}));

vi.mock('@/helpers/getStudentGradeLevel', () => ({
  getStudentGradeLevel: vi.fn(),
}));

describe('useScoreListData', () => {
  let mockT;

  beforeEach(() => {
    vi.clearAllMocks();
    mockT = vi.fn((key) => key);
    getStudentGradeLevel.mockReturnValue(5);
  });

  describe('basic functionality', () => {
    it('should process task data using ScoreReportService', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      // Access the computed value to trigger evaluation
      const result = computedTaskData.value;

      expect(getStudentGradeLevel).toHaveBeenCalledWith('Grade 5');
      expect(ScoreReportService.processTaskScores).toHaveBeenCalledWith(taskData, 5, { t: mockT });
      expect(result).toEqual(processedTasks);
    });

    it('should handle phonics subscores', () => {
      const taskData = [
        {
          taskId: 'phonics',
          scores: {
            composite: {
              subscores: {
                skill1: { correct: 8, attempted: 10 },
                skill2: { correct: 7, attempted: 10 },
              },
            },
          },
        },
      ];

      const processedTasks = [
        {
          taskId: 'phonics',
          rawScore: { value: 15 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
          scores: {
            composite: {
              subscores: {
                skill1: { correct: 8, attempted: 10 },
                skill2: { correct: 7, attempted: 10 },
              },
            },
          },
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      const phonicsTask = computedTaskData.value[0];
      expect(phonicsTask.rawScore.subscores).toEqual({
        skill1: '8/10',
        skill2: '7/10',
      });
    });

    it('should not add subscores for non-phonics tasks', () => {
      const taskData = [
        {
          taskId: 'swr',
          scores: {
            composite: {
              subscores: {
                skill1: { correct: 8, attempted: 10 },
              },
            },
          },
        },
      ];

      const processedTasks = [
        {
          taskId: 'swr',
          rawScore: { value: 15 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
          scores: {
            composite: {
              subscores: {
                skill1: { correct: 8, attempted: 10 },
              },
            },
          },
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      expect(computedTaskData.value[0].rawScore.subscores).toBeUndefined();
    });
  });

  describe('longitudinal data processing', () => {
    it('should add historical scores when longitudinal data is provided', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const longitudinalData = {
        task1: [
          { date: '2024-01-01', scores: { composite: { rawScore: 8 } }, assignmentId: 'a1' },
          { date: '2024-02-01', scores: { composite: { rawScore: 9 } }, assignmentId: 'a2' },
        ],
      };

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);
      getScoreValue.mockImplementation((composite, taskId, grade, type) => {
        if (type === 'rawScore') return composite.rawScore;
        return undefined;
      });

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData,
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      expect(computedTaskData.value[0].historicalScores).toBeDefined();
      expect(computedTaskData.value[0].historicalScores).toHaveLength(2);
      expect(computedTaskData.value[0].historicalScores[0].scores.rawScore).toBe(8);
      expect(computedTaskData.value[0].historicalScores[1].scores.rawScore).toBe(9);
    });

    it('should sort historical scores by date', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const longitudinalData = {
        task1: [
          { date: '2024-03-01', scores: { composite: { rawScore: 12 } }, assignmentId: 'a3' },
          { date: '2024-01-01', scores: { composite: { rawScore: 8 } }, assignmentId: 'a1' },
          { date: '2024-02-01', scores: { composite: { rawScore: 10 } }, assignmentId: 'a2' },
        ],
      };

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);
      getScoreValue.mockImplementation((composite, taskId, grade, type) => {
        if (type === 'rawScore') return composite.rawScore;
        return undefined;
      });

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData,
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      const history = computedTaskData.value[0].historicalScores;
      expect(history[0].scores.rawScore).toBe(8);
      expect(history[1].scores.rawScore).toBe(10);
      expect(history[2].scores.rawScore).toBe(12);
    });

    it('should round historical score values', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const longitudinalData = {
        task1: [{ date: '2024-01-01', scores: { composite: { rawScore: 8.7 } }, assignmentId: 'a1' }],
      };

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);
      getScoreValue.mockReturnValue(8.7);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData,
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      expect(computedTaskData.value[0].historicalScores[0].scores.rawScore).toBe(9);
    });

    it('should filter out undefined score values from historical data', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const longitudinalData = {
        task1: [{ date: '2024-01-01', scores: { composite: { rawScore: 8 } }, assignmentId: 'a1' }],
      };

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);
      getScoreValue.mockImplementation((composite, taskId, grade, type) => {
        if (type === 'rawScore') return composite.rawScore;
        return undefined; // Percentile and standardScore return undefined
      });

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData,
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      const scores = computedTaskData.value[0].historicalScores[0].scores;
      expect(scores.rawScore).toBe(8);
      expect(scores.percentileScore).toBeUndefined();
      expect(scores.standardScore).toBeUndefined();
    });

    it('should handle empty longitudinal data object', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: {},
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      expect(computedTaskData.value[0].historicalScores).toBeUndefined();
    });

    it('should handle tasks with no historical data', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const longitudinalData = {
        task2: [{ date: '2024-01-01', scores: { composite: { rawScore: 8 } }, assignmentId: 'a1' }],
      };

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData,
        t: mockT,
      };

      const { computedTaskData } = useScoreListData(params);

      expect(computedTaskData.value[0].historicalScores).toEqual([]);
    });
  });

  describe('scoreValueTemplate', () => {
    it('should append percentage for phonics tasks', () => {
      const taskData = [
        {
          taskId: 'phonics',
          scores: { composite: { rawScore: 85 } },
        },
      ];

      const processedTasks = [
        {
          taskId: 'phonics',
          rawScore: { value: 85 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData, scoreValueTemplate } = useScoreListData(params);

      const result = scoreValueTemplate.value(computedTaskData.value[0]);
      expect(result).toBe('85%');
    });

    it('should append percentage for letter tasks', () => {
      const taskData = [
        {
          taskId: 'letter',
          scores: { composite: { rawScore: 90 } },
        },
      ];

      const processedTasks = [
        {
          taskId: 'letter',
          rawScore: { value: 90 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData, scoreValueTemplate } = useScoreListData(params);

      const result = scoreValueTemplate.value(computedTaskData.value[0]);
      expect(result).toBe('90%');
    });

    it('should return percentile suffix for percentile score type', () => {
      const taskData = [
        {
          taskId: 'swr',
          scores: { composite: { percentileScore: 75 } },
        },
      ];

      const processedTasks = [
        {
          taskId: 'swr',
          percentileScore: { value: 75 },
          scoreToDisplay: SCORE_TYPES.PERCENTILE_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);
      ScoreReportService.getPercentileSuffixTemplate.mockReturnValue('75th');

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData, scoreValueTemplate } = useScoreListData(params);

      const result = scoreValueTemplate.value(computedTaskData.value[0]);
      expect(result).toBe('75th');
      expect(ScoreReportService.getPercentileSuffixTemplate).toHaveBeenCalledWith(75);
    });

    it('should return undefined for non-percentile score types', () => {
      const taskData = [
        {
          taskId: 'swr',
          scores: { composite: { standardScore: 100 } },
        },
      ];

      const processedTasks = [
        {
          taskId: 'swr',
          standardScore: { value: 100 },
          percentileScore: { value: 50 },
          scoreToDisplay: SCORE_TYPES.STANDARD_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData, scoreValueTemplate } = useScoreListData(params);

      const result = scoreValueTemplate.value(computedTaskData.value[0]);
      expect(result).toBeUndefined();
    });
  });

  describe('getTaskDescription', () => {
    it('should call ScoreReportService.getScoreDescription with correct parameters', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);
      ScoreReportService.getScoreDescription.mockReturnValue({ keypath: 'test.description' });

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData, getTaskDescription } = useScoreListData(params);

      const result = getTaskDescription.value(computedTaskData.value[0]);
      expect(ScoreReportService.getScoreDescription).toHaveBeenCalledWith(computedTaskData.value[0], 5, { t: mockT });
      expect(result).toEqual({ keypath: 'test.description' });
    });
  });

  describe('getTaskScoresArray', () => {
    it('should call ScoreReportService.getScoresArrayForTask', () => {
      const taskData = [
        {
          taskId: 'task1',
          scores: { composite: { rawScore: 10 } },
        },
      ];

      const processedTasks = [
        {
          taskId: 'task1',
          rawScore: { value: 10 },
          scoreToDisplay: SCORE_TYPES.RAW_SCORE,
        },
      ];

      ScoreReportService.processTaskScores.mockReturnValue(processedTasks);
      ScoreReportService.getScoresArrayForTask.mockReturnValue([{ name: 'skill1', value: 5 }]);

      const params = {
        studentGrade: 'Grade 5',
        taskData,
        longitudinalData: null,
        t: mockT,
      };

      const { computedTaskData, getTaskScoresArray } = useScoreListData(params);

      const result = getTaskScoresArray.value(computedTaskData.value[0]);
      expect(ScoreReportService.getScoresArrayForTask).toHaveBeenCalledWith(computedTaskData.value[0]);
      expect(result).toEqual([{ name: 'skill1', value: 5 }]);
    });
  });
});
