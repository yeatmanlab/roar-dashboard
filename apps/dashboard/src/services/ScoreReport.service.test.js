import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScoreReportService from '@/services/ScoreReport.service';
import { SCORE_SUPPORT_SKILL_LEVELS, SCORE_TYPES } from '@/constants/scores';

import { getSupportLevel, getRawScoreRange } from '@/helpers/reports';

// Mock dependencies
vi.mock('@/helpers/reports', () => ({
  rawOnlyTasks: ['mock-raw-task'],
  taskDisplayNames: {
    'mock-task-1': { extendedName: 'Task One', order: 1 },
    'mock-task-2': { extendedName: 'Task Two', order: 2 },
    'mock-raw-task': { extendedName: 'Raw Only Task', order: 3 },
  },
  extendedDescriptions: {
    'mock-task-1': 'Description for task one',
    'mock-task-2': 'Description for task two',
    'mock-raw-task': 'Description for raw only task',
  },
  getSupportLevel: vi.fn(),
  getRawScoreRange: vi.fn(),
  getScoreValue: vi.fn().mockImplementation((scoresObject, taskId, grade, fieldType) => {
    // Return the actual field value from the scores object if it exists
    // This allows the test to use real data from the mock task data
    if (scoresObject && fieldType) {
      switch (fieldType) {
        case 'rawScore':
          return scoresObject.rawScore;
        case 'percentile':
          return scoresObject.percentileScore;
        case 'standardScore':
          return scoresObject.standardScore;
        default:
          return undefined;
      }
    }
    return undefined;
  }),
}));

describe('ScoreReportService', () => {
  let mockI18n;

  beforeEach(() => {
    getSupportLevel.mockReturnValue({
      support_level: SCORE_SUPPORT_SKILL_LEVELS.DEVELOPING_SKILL,
      tag_color: 'orange',
    });

    // Mock i18n instance
    mockI18n = {
      t: vi.fn((key, options) => {
        // Simple mock implementation that returns the key with options
        if (options) {
          return `${key}(${JSON.stringify(options)})`;
        }
        return key;
      }),
    };

    vi.clearAllMocks();
  });

  describe('getPercentileSuffixTemplate', () => {
    it('should return template strings for percentiles ending in 1 (except 11)', () => {
      expect(ScoreReportService.getPercentileSuffixTemplate(1)).toBe('{value}st');
      expect(ScoreReportService.getPercentileSuffixTemplate(21)).toBe('{value}st');
      expect(ScoreReportService.getPercentileSuffixTemplate(31)).toBe('{value}st');
    });

    it('should return template strings for percentiles ending in 2 (except 12)', () => {
      expect(ScoreReportService.getPercentileSuffixTemplate(2)).toBe('{value}nd');
      expect(ScoreReportService.getPercentileSuffixTemplate(22)).toBe('{value}nd');
      expect(ScoreReportService.getPercentileSuffixTemplate(32)).toBe('{value}nd');
    });

    it('should return template strings for percentiles ending in 3 (except 13)', () => {
      expect(ScoreReportService.getPercentileSuffixTemplate(3)).toBe('{value}rd');
      expect(ScoreReportService.getPercentileSuffixTemplate(23)).toBe('{value}rd');
      expect(ScoreReportService.getPercentileSuffixTemplate(33)).toBe('{value}rd');
    });

    it('should return template strings for special cases and others with "th"', () => {
      expect(ScoreReportService.getPercentileSuffixTemplate(11)).toBe('{value}th');
      expect(ScoreReportService.getPercentileSuffixTemplate(12)).toBe('{value}th');
      expect(ScoreReportService.getPercentileSuffixTemplate(13)).toBe('{value}th');
      expect(ScoreReportService.getPercentileSuffixTemplate(50)).toBe('{value}th');
    });
  });

  describe('getScoreDescription', () => {
    it('should return raw task description for raw-only tasks', () => {
      const task = {
        taskId: 'mock-raw-task',
        rawScore: { value: 15 },
        percentileScore: { value: 45 },
        standardScore: { value: 85 },
      };

      const result = ScoreReportService.getScoreDescription(task, 3, mockI18n);

      expect(result).toEqual({
        keypath: 'scoreReports.rawTaskDescription',
        slots: {
          rawScore: 15,
          taskName: 'Raw Only Task',
          taskDescription: 'Description for raw only task',
        },
      });
    });

    it('should return standard task description for grade 6 and above', () => {
      const task = {
        taskId: 'mock-task-1',
        rawScore: { value: 20 },
        percentileScore: { value: 65 },
        standardScore: { value: 95 },
      };

      const result = ScoreReportService.getScoreDescription(task, 6, mockI18n);

      expect(result.keypath).toBe('scoreReports.standardTaskDescription');
      expect(result.slots.standardScore).toBe(95);
      expect(result.slots.taskName).toBe('Task One');
      expect(result.slots.taskDescription).toBe('Description for task one');
      expect(result.slots.supportCategory).toBe('scoreReports.developingText');
    });

    it('should return percentile task description for grades below 6', () => {
      const task = {
        taskId: 'mock-task-2',
        rawScore: { value: 18 },
        percentileScore: { value: 55 },
        standardScore: { value: 88 },
      };

      const result = ScoreReportService.getScoreDescription(task, 4, mockI18n);

      expect(result.keypath).toBe('scoreReports.percentileTaskDescription');
      expect(result.slots.percentile).toBe('55th percentile');
      expect(result.slots.taskName).toBe('Task Two');
      expect(result.slots.taskDescription).toBe('Description for task two');
      expect(result.slots.supportCategory).toBe('scoreReports.developingText');
    });
  });

  describe('getScoresArrayForTask', () => {
    it('should return undefined for tasks not in rawOnlyTasks when scoresArray is not provided', () => {
      const task = { taskId: 'mock-task-1' }; // not in rawOnlyTasks, no scoresArray
      expect(ScoreReportService.getScoresArrayForTask(task)).toBeUndefined();
    });

    it('should return null for raw-only tasks (except letter tasks)', () => {
      const task = { taskId: 'mock-raw-task' }; // in rawOnlyTasks
      expect(ScoreReportService.getScoresArrayForTask(task)).toBeNull();
    });

    it('should return scores array for tasks that have one', () => {
      const task = {
        taskId: 'mock-task-1',
        scoresArray: [
          { name: 'score1', value: 10 },
          { name: 'score2', value: 20 },
        ],
      };

      expect(ScoreReportService.getScoresArrayForTask(task)).toEqual([
        { name: 'score1', value: 10 },
        { name: 'score2', value: 20 },
      ]);
    });

    it('should handle specific task types with scores arrays', () => {
      // Test for specific task IDs that should have scores arrays
      const taskWithScores = {
        taskId: 'pa',
        scoresArray: [{ name: 'phoneme', value: 15 }],
      };

      expect(ScoreReportService.getScoresArrayForTask(taskWithScores)).toEqual([{ name: 'phoneme', value: 15 }]);
    });
  });

  describe('processTaskScores', () => {
    beforeEach(() => {
      getRawScoreRange.mockReturnValue({ min: 0, max: 100 });
    });

    it('should process task data into formatted task scores', () => {
      const taskData = [
        {
          taskId: 'mock-task-1',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 65,
              standardScore: 95,
            },
          },
        },
        {
          taskId: 'mock-raw-task',
          optional: true,
          reliable: false,
          scores: {
            composite: {
              rawScore: 15,
              percentileScore: 45,
              standardScore: 85,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(2);

      // Check first task
      expect(result[0].taskId).toBe('mock-task-1');
      expect(result[0].scoreToDisplay).toBe(SCORE_TYPES.PERCENTILE_SCORE); // grade < 6
      expect(result[0].rawScore.value).toBe(20);
      expect(result[0].percentileScore.value).toBe(65);
      expect(result[0].standardScore.value).toBe(95);
      expect(result[0].tags).toHaveLength(2);

      // Check second task
      expect(result[1].taskId).toBe('mock-raw-task');
      expect(result[1].scoreToDisplay).toBe(SCORE_TYPES.RAW_SCORE); // raw-only task
      expect(result[1].rawScore.value).toBe(15);
      expect(result[1].percentileScore.value).toBe(45);
      expect(result[1].standardScore.value).toBe(85);
      expect(result[1].tags).toHaveLength(2);
    });

    it('should handle grade >= 6 with standard score display', () => {
      const taskData = [
        {
          taskId: 'mock-task-1',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 25,
              percentileScore: 75,
              standardScore: 105,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 7, mockI18n); // grade >= 6

      expect(result).toHaveLength(1);
      expect(result[0].scoreToDisplay).toBe(SCORE_TYPES.STANDARD_SCORE);
    });

    it('should filter out blacklisted tasks', () => {
      const taskData = [
        {
          taskId: 'vocab',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 65,
              standardScore: 95,
            },
          },
        },
        {
          taskId: 'cva',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 18,
              percentileScore: 60,
              standardScore: 90,
            },
          },
        },
        {
          taskId: 'mock-task-1',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 22,
              percentileScore: 70,
              standardScore: 100,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe('mock-task-1');
    });

    it('should handle vocab/es tasks without scoringVersions with composite scores directly', () => {
      const taskData = [
        {
          taskId: 'vocab-test',
          optional: false,
          reliable: true,
          scores: {
            composite: 25, // Direct number for vocab/es tasks
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      expect(result[0].rawScore.value).toBe(25);
    });

    it('should handle es tasks with scoringVersion with rawScores directly', () => {
      const taskData = [
        {
          taskId: 'swr-es',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 25,
              percentileScore: 50,
              standardScore: 30,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n, { 'swr-es': 1 });

      expect(result).toHaveLength(1);
      expect(result[0].rawScore.value).toBe(25);
    });

    it('should filter out tasks with NaN raw scores', () => {
      const taskData = [
        {
          taskId: 'mock-task-1',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: NaN,
              percentileScore: 65,
              standardScore: 95,
            },
          },
        },
        {
          taskId: 'mock-task-2',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 70,
              standardScore: 100,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe('mock-task-2');
    });

    it('should handle engagement flags in tags', () => {
      const taskData = [
        {
          taskId: 'mock-task-1',
          optional: true,
          reliable: false,
          engagementFlags: {
            lowEngagement: true,
            fastResponse: true,
          },
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 65,
              standardScore: 95,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      expect(result[0].tags).toHaveLength(2);
    });

    it('should sort results by task display order', () => {
      const taskData = [
        {
          taskId: 'mock-raw-task', // order: 3
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 15,
              percentileScore: 45,
              standardScore: 85,
            },
          },
        },
        {
          taskId: 'mock-task-1', // order: 1
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 65,
              standardScore: 95,
            },
          },
        },
        {
          taskId: 'mock-task-2', // order: 2
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 18,
              percentileScore: 55,
              standardScore: 88,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(3);
      expect(result[0].taskId).toBe('mock-task-1');
      expect(result[1].taskId).toBe('mock-task-2');
      expect(result[2].taskId).toBe('mock-raw-task');
    });

    it('should handle missing scores gracefully', () => {
      const taskData = [
        {
          taskId: 'mock-task-1',
          optional: false,
          reliable: true,
          scores: null, // Missing scores
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(0); // Should filter out tasks with missing scores
    });

    it('should create comprehensive tags data with all properties', () => {
      const taskData = [
        {
          taskId: 'mock-task-1',
          optional: true,
          reliable: false,
          engagementFlags: {
            lowEngagement: { severity: 'warning', message: 'Low engagement detected' },
            fastResponse: { severity: 'info', message: 'Fast response time' },
          },
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 65,
              standardScore: 95,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      const task = result[0];

      // Verify tags structure and properties
      expect(task.tags).toHaveLength(2);
      expect(Array.isArray(task.tags)).toBe(true);

      // Verify each tag has required properties
      task.tags.forEach((tag) => {
        expect(tag).toHaveProperty('icon');
        expect(tag).toHaveProperty('value');
        expect(tag).toHaveProperty('severity');
        expect(tag).toHaveProperty('tooltip');
        expect(typeof tag.icon).toBe('string');
        expect(typeof tag.value).toBe('string');
        expect(typeof tag.severity).toBe('string');
        expect(typeof tag.tooltip).toBe('string');
      });
    });

    it('should handle PA task with special score processing', () => {
      const taskData = [
        {
          taskId: 'pa',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 65,
              standardScore: 95,
            },
            FSM: { roarScore: 10 }, // Below 15 threshold
            LSM: { roarScore: 20 }, // Above 15 threshold
            DEL: { roarScore: 8 }, // Below 15 threshold
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      const task = result[0];

      expect(task.taskId).toBe('pa');
      expect(task.scoresArray).toBeDefined();

      // Verify that i18n.t was called for PA-specific translations
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.firstSoundMatching');
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.lastSoundMatching');
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.deletion');
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.skillsToWorkOn');
    });

    it('should handle PA task with all skills above threshold', () => {
      const taskData = [
        {
          taskId: 'pa',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 25,
              percentileScore: 85,
              standardScore: 110,
            },
            FSM: { roarScore: 20 }, // Above 15 threshold
            LSM: { roarScore: 18 }, // Above 15 threshold
            DEL: { roarScore: 22 }, // Above 15 threshold
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      const task = result[0];

      expect(task.taskId).toBe('pa');
      expect(task.scoresArray).toBeDefined();

      // When all skills are above threshold, "skillsToWorkOn" should show "None"
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.skillsToWorkOn');
    });

    it('should handle PA task with LSM skill below threshold', () => {
      const taskData = [
        {
          taskId: 'pa',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 65,
              standardScore: 95,
            },
            FSM: { roarScore: 20 }, // Above 15 threshold
            LSM: { roarScore: 10 }, // Below 15 threshold - this covers line 150
            DEL: { roarScore: 18 }, // Above 15 threshold
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      const task = result[0];

      expect(task.taskId).toBe('pa');
      expect(task.scoresArray).toBeDefined();

      // Verify that LSM-specific translations were called
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.lastSoundMatching');
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.skillsToWorkOn');

      // Since only LSM is below threshold, skills to work on should include LSM
      // The actual skills array logic is tested through the i18n calls
    });

    it('should validate complete tags object structure for required and reliable task', () => {
      const taskData = [
        {
          taskId: 'mock-task-1',
          optional: false,
          reliable: true,
          scores: {
            composite: {
              rawScore: 20,
              percentileScore: 65,
              standardScore: 95,
            },
          },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(1);
      const task = result[0];

      // Validate complete tag structure
      expect(task.tags).toHaveLength(2);

      // Verify tags contain expected properties and structure
      task.tags.forEach((tag) => {
        expect(tag).toHaveProperty('icon');
        expect(tag).toHaveProperty('value');
        expect(tag).toHaveProperty('severity');
        expect(tag).toHaveProperty('tooltip');

        // Verify property types
        expect(typeof tag.icon).toBe('string');
        expect(typeof tag.value).toBe('string');
        expect(typeof tag.severity).toBe('string');
        expect(typeof tag.tooltip).toBe('string');

        // Verify icon format
        expect(tag.icon).toMatch(/^pi pi-/);
      });

      // Verify we have both required/optional and reliable/unreliable tags
      const tagValues = task.tags.map((tag) => tag.value);
      expect(tagValues).toHaveLength(2);
    });

    it('should handle different combinations of optional and reliable flags', () => {
      const taskData = [
        {
          taskId: 'mock-task-1',
          optional: true,
          reliable: true,
          scores: { composite: { rawScore: 20, percentileScore: 65, standardScore: 95 } },
        },
        {
          taskId: 'mock-task-2',
          optional: false,
          reliable: false,
          scores: { composite: { rawScore: 15, percentileScore: 45, standardScore: 85 } },
        },
      ];

      const result = ScoreReportService.processTaskScores(taskData, 5, mockI18n);

      expect(result).toHaveLength(2);

      // Verify both tasks have tags with proper structure
      result.forEach((task) => {
        expect(task.tags).toHaveLength(2);
        expect(Array.isArray(task.tags)).toBe(true);

        task.tags.forEach((tag) => {
          expect(tag).toHaveProperty('icon');
          expect(tag).toHaveProperty('value');
          expect(tag).toHaveProperty('severity');
          expect(tag).toHaveProperty('tooltip');
        });
      });

      // Verify tasks are sorted by display order
      expect(result[0].taskId).toBe('mock-task-1'); // order: 1
      expect(result[1].taskId).toBe('mock-task-2'); // order: 2
    });

    it('should handle different support levels in getSupportLevelLanguage', () => {
      // Test ACHIEVED_SKILL level
      getSupportLevel.mockReturnValueOnce({
        support_level: SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL,
        tag_color: 'green',
      });

      const taskDataAchieved = {
        taskId: 'mock-task-1',
        standardScore: { value: 110 },
        percentileScore: { value: 90 },
        rawScore: { value: 30 },
      };

      // Clear previous mock calls to isolate this test
      mockI18n.t.mockClear();

      ScoreReportService.getScoreDescription(taskDataAchieved, 5, mockI18n);
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.achievedText');

      // Test NEEDS_EXTRA_SUPPORT level
      getSupportLevel.mockReturnValueOnce({
        support_level: SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT,
        tag_color: 'red',
      });

      const taskDataNeedsSupport = {
        taskId: 'mock-task-1',
        standardScore: { value: 70 },
        percentileScore: { value: 10 },
        rawScore: { value: 5 },
      };

      // Clear previous mock calls to isolate this test
      mockI18n.t.mockClear();

      ScoreReportService.getScoreDescription(taskDataNeedsSupport, 5, mockI18n);
      expect(mockI18n.t).toHaveBeenCalledWith('scoreReports.extraSupportText');

      // Test unknown/default support level
      getSupportLevel.mockReturnValueOnce({
        support_level: 'UNKNOWN_LEVEL',
        tag_color: 'gray',
      });

      const taskDataUnknown = {
        taskId: 'mock-task-1',
        standardScore: { value: 90 },
        percentileScore: { value: 50 },
        rawScore: { value: 15 },
      };

      // Clear previous mock calls to isolate this test
      mockI18n.t.mockClear();

      const resultUnknown = ScoreReportService.getScoreDescription(taskDataUnknown, 5, mockI18n);
      // For unknown support level, getSupportLevelLanguage should return empty string
      // The result should contain an empty supportCategory
      expect(resultUnknown.slots.supportCategory).toBe('');
    });
  });
});
