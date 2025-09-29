import { describe, it, expect, vi } from 'vitest';
import {
  taskDisplayNames,
  addElementToPdf,
  getSupportLevel,
  getScoreValue,
  getRawScoreThreshold,
  getRawScoreRange,
  getTagColor,
  supportLevelColors,
  replaceScoreRange,
  taskInfoById,
} from './reports';

vi.mock('./index', () => ({
  flattenObj: vi.fn((obj) => obj),
}));

vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('mock-image-data'),
    height: 100,
    width: 200,
  }),
}));

vi.mock(
  '@bdelab/roar-utils',
  () => ({
    getGrade: vi.fn((grade) => parseInt(grade)),
  }),
  { virtual: true },
);

describe('reports', () => {
  global.document = {
    createElement: vi.fn().mockReturnValue({
      style: {},
      click: vi.fn(),
    }),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  };

  describe('getSupportLevel', () => {
    describe('old scoring', () => {
      it('should return null support level when rawScore is undefined', () => {
        const result = getSupportLevel(3, 50, undefined, 'swr', false);
        expect(result).toEqual({
          support_level: null,
          tag_color: null,
        });
      });

      it('should return Optional support level when optional is true', () => {
        const result = getSupportLevel(3, 50, 100, 'swr', true, false);
        expect(result).toEqual({
          support_level: 'Optional',
          tag_color: undefined,
        });
      });

      it('should return Achieved Skill for percentile >= 50 and grade < 6', () => {
        const result = getSupportLevel(3, 75, 100, 'swr', false);
        expect(result).toEqual({
          support_level: 'Achieved Skill',
          tag_color: 'green',
        });
      });

      it('should return Developing Skill for percentile between 25 and 50', () => {
        const result = getSupportLevel(3, 30, 100, 'swr', false);
        expect(result).toEqual({
          support_level: 'Developing Skill',
          tag_color: '#edc037',
        });
      });

      it('should return Needs Extra Support for percentile <= 25', () => {
        const result = getSupportLevel(3, 20, 100, 'swr', false);
        expect(result).toEqual({
          support_level: 'Needs Extra Support',
          tag_color: '#c93d82',
        });
      });

      it('should use raw score thresholds for grade >= 6', () => {
        const result = getSupportLevel(6, undefined, 600, 'swr', false);
        expect(result).toEqual({
          support_level: 'Achieved Skill',
          tag_color: 'green',
        });
      });
    });

    describe('new scoring', () => {
      it('should return Achieved Skill for percentile >= 40 and grade < 6', () => {
        const result = getSupportLevel(3, 50, 513, 'swr', false, 7);
        expect(result).toEqual({
          support_level: 'Achieved Skill',
          tag_color: 'green',
        });
      });

      it('should return Developing Skill for percentile between 20 and 40', () => {
        const result = getSupportLevel(3, 21, 413, 'swr', false, 7);
        expect(result).toEqual({
          support_level: 'Developing Skill',
          tag_color: '#edc037',
        });
      });

      it('should return Needs Extra Support for percentile <= 20', () => {
        const result = getSupportLevel(3, 20, 100, 'swr', false, 7);
        expect(result).toEqual({
          support_level: 'Needs Extra Support',
          tag_color: '#c93d82',
        });
      });

      it('should return Achieved Skill for percentile >= 40 and grade < 6 for sre', () => {
        const result = getSupportLevel(3, 40, 41, 'sre', false, 4);
        expect(result).toEqual({
          support_level: 'Achieved Skill',
          tag_color: 'green',
        });
      });

      it('should return Achieved Skill for grade >= 6 for swr', () => {
        const result = getSupportLevel(6, undefined, 520, 'swr', false, 7);
        expect(result).toEqual({
          support_level: 'Achieved Skill',
          tag_color: 'green',
        });
      });

      it('should return Developing Skill for grade >= 6 for swr-es', () => {
        const result = getSupportLevel(6, undefined, 500, 'swr-es', false, 1);
        expect(result).toEqual({
          support_level: 'Developing Skill',
          tag_color: '#edc037',
        });
      });

      it('should return Developing Skill for grade >= 6 for sre', () => {
        const result = getSupportLevel(6, undefined, 30, 'sre', false, 4);
        expect(result).toEqual({
          support_level: 'Developing Skill',
          tag_color: '#edc037',
        });
      });

      it('should return Needs Extra Support for grade >= 6 for sre-es', () => {
        const result = getSupportLevel(6, undefined, 10, 'sre-es', false, 1);
        expect(result).toEqual({
          support_level: 'Needs Extra Support',
          tag_color: '#c93d82',
        });
      });

      it('should fallback to legacy thresholds for grade >= 6', () => {
        const result = getSupportLevel(6, undefined, 30, 'sre', false);
        expect(result).toEqual({
          support_level: 'Needs Extra Support',
          tag_color: '#c93d82',
        });
      });

      it('should return null for old scoring without scoring version (unnormed)', () => {
        const result = getSupportLevel(6, undefined, 30, 'sre-es', false);

        expect(result).toEqual({
          support_level: null,
          tag_color: null,
        });
      });
    });
  });

  describe('getScoreValue', () => {
    describe('basic functionality', () => {
      it('should return value from new field name when available', () => {
        const scoresObject = {
          percentile: 75,
          wjPercentile: 50, // legacy field
        };
        const result = getScoreValue(scoresObject, 'swr', 3, 'percentile');
        expect(result).toBe(75);
      });

      it('should fallback to legacy field name when new field is missing', () => {
        const scoresObject = {
          wjPercentile: 50, // only legacy field exists
        };
        // Simulate a scenario where legacy field name is different
        const result = getScoreValue(scoresObject, 'swr', 3, 'percentile');
        expect(result).toBe(50); // Since both new is 'percentile' and legacy are 'wjPercentile' in current config
      });

      it('should return undefined when neither field exists', () => {
        const scoresObject = {
          someOtherField: 100,
        };
        const result = getScoreValue(scoresObject, 'swr', 3, 'percentile');
        expect(result).toBe(undefined);
      });

      it('should handle invalid inputs gracefully', () => {
        expect(getScoreValue(null, 'swr', 3, 'percentile')).toBe(undefined);
        expect(getScoreValue({}, null, 3, 'percentile')).toBe(undefined);
      });

      it('should handle unknown task IDs gracefully', () => {
        const scoresObject = { someField: 100 };
        const result = getScoreValue(scoresObject, 'unknownTask', 3, 'percentile');
        expect(result).toBe(undefined);
      });

      it('should validate fieldType parameter', () => {
        const scoresObject = { someField: 100 };
        expect(() => getScoreValue(scoresObject, 'swr', 3, 'invalidFieldType')).toThrow(
          'Invalid fieldType. Expected one of percentile, standardScore, rawScore, percentileDisplay, standardScoreDisplay, but got invalidFieldType',
        );
      });
    });

    describe('SWR task field mapping', () => {
      it('should retrieve correct legacy field values for swr task', () => {
        const scoresObject = {
          wjPercentile: 75,
          standardScore: 110,
          roarScore: 550,
        };

        expect(getScoreValue(scoresObject, 'swr', 3, 'percentile')).toBe(75);
        expect(getScoreValue(scoresObject, 'swr', 3, 'percentileDisplay')).toBe(75);
        expect(getScoreValue(scoresObject, 'swr', 3, 'standardScore')).toBe(110);
        expect(getScoreValue(scoresObject, 'swr', 3, 'standardScoreDisplay')).toBe(110);
        expect(getScoreValue(scoresObject, 'swr', 3, 'rawScore')).toBe(550);
      });

      it('should retrieve correct legacy field values for swr-es task', () => {
        const scoresObject = {
          wjPercentile: 65,
          standardScore: 105,
          roarScore: 480,
        };

        expect(getScoreValue(scoresObject, 'swr-es', 4, 'percentile')).toBe(65);
        expect(getScoreValue(scoresObject, 'swr-es', 4, 'percentileDisplay')).toBe(65);
        expect(getScoreValue(scoresObject, 'swr-es', 4, 'standardScore')).toBe(105);
        expect(getScoreValue(scoresObject, 'swr-es', 4, 'standardScoreDisplay')).toBe(105);
        expect(getScoreValue(scoresObject, 'swr-es', 4, 'rawScore')).toBe(480);
      });

      it('should retrieve correct new field values for swr task', () => {
        const scoresObject = {
          percentile: 75,
          standardScore: 110,
          roarScore: 550,
        };

        expect(getScoreValue(scoresObject, 'swr', 3, 'percentile')).toBe(75);
        expect(getScoreValue(scoresObject, 'swr', 3, 'percentileDisplay')).toBe(75);
        expect(getScoreValue(scoresObject, 'swr', 3, 'standardScore')).toBe(110);
        expect(getScoreValue(scoresObject, 'swr', 3, 'standardScoreDisplay')).toBe(110);
        expect(getScoreValue(scoresObject, 'swr', 3, 'rawScore')).toBe(550);
      });

      it('should retrieve correct new field values for swr-es task', () => {
        const scoresObject = {
          percentile: 65,
          standardScore: 105,
          roarScore: 480,
        };

        expect(getScoreValue(scoresObject, 'swr-es', 4, 'percentile')).toBe(65);
        expect(getScoreValue(scoresObject, 'swr-es', 4, 'percentileDisplay')).toBe(65);
        expect(getScoreValue(scoresObject, 'swr-es', 4, 'standardScore')).toBe(105);
        expect(getScoreValue(scoresObject, 'swr-es', 4, 'standardScoreDisplay')).toBe(105);
        expect(getScoreValue(scoresObject, 'swr-es', 4, 'rawScore')).toBe(480);
      });
    });

    describe('PA task field mapping with grade dependency', () => {
      it('should retrieve correct field values for pa task with grade < 6', () => {
        const scoresObject = {
          percentile: 60,
          standardScore: 95,
          roarScore: 45,
        };

        expect(getScoreValue(scoresObject, 'pa', 3, 'percentile')).toBe(60);
        expect(getScoreValue(scoresObject, 'pa', 3, 'percentileDisplay')).toBe(60);
        expect(getScoreValue(scoresObject, 'pa', 3, 'standardScore')).toBe(95);
        expect(getScoreValue(scoresObject, 'pa', 3, 'standardScoreDisplay')).toBe(95);
        expect(getScoreValue(scoresObject, 'pa', 3, 'rawScore')).toBe(45);
      });

      it('should retrieve correct field values for pa task with grade >= 6', () => {
        const scoresObject = {
          sprPercentile: 70,
          sprPercentileString: '>99',
          sprStandardScore: 120,
          sprStandardScoreString: '>120',
          roarScore: 55,
        };

        expect(getScoreValue(scoresObject, 'pa', 6, 'percentile')).toBe(70);
        expect(getScoreValue(scoresObject, 'pa', 6, 'percentileDisplay')).toBe('>99');
        expect(getScoreValue(scoresObject, 'pa', 6, 'standardScore')).toBe(120);
        expect(getScoreValue(scoresObject, 'pa', 6, 'standardScoreDisplay')).toBe('>120');
        expect(getScoreValue(scoresObject, 'pa', 6, 'rawScore')).toBe(55);
      });

      it('should handle grade-dependent field names correctly', () => {
        const scoresObject = {
          percentile: 60,
          sprPercentile: 70,
        };

        // Grade < 6 should use 'percentile'
        const resultGrade3 = getScoreValue(scoresObject, 'pa', 3, 'percentile');
        expect(resultGrade3).toBe(60);

        // Grade >= 6 should use 'sprPercentile'
        const resultGrade6 = getScoreValue(scoresObject, 'pa', 6, 'percentile');
        expect(resultGrade6).toBe(70);
      });
    });

    describe('SRE task field mapping with grade dependency', () => {
      it('should retrieve correct legacy field values for sre task with grade < 6', () => {
        const scoresObject = {
          tosrecPercentile: 45,
          tosrecSS: 88,
          sreScore: 65,
        };

        expect(getScoreValue(scoresObject, 'sre', 4, 'percentile')).toBe(45);
        expect(getScoreValue(scoresObject, 'sre', 4, 'percentileDisplay')).toBe(45);
        expect(getScoreValue(scoresObject, 'sre', 4, 'standardScore')).toBe(88);
        expect(getScoreValue(scoresObject, 'sre', 4, 'standardScoreDisplay')).toBe(88);
        expect(getScoreValue(scoresObject, 'sre', 4, 'rawScore')).toBe(65);
      });

      it('should retrieve correct legacy field values for sre task with grade >= 6', () => {
        const scoresObject = {
          sprPercentile: 55,
          sprStandardScore: 102,
          sreScore: 75,
        };

        expect(getScoreValue(scoresObject, 'sre', 7, 'percentile')).toBe(55);
        expect(getScoreValue(scoresObject, 'sre', 7, 'percentileDisplay')).toBe(55);
        expect(getScoreValue(scoresObject, 'sre', 7, 'standardScore')).toBe(102);
        expect(getScoreValue(scoresObject, 'sre', 7, 'standardScoreDisplay')).toBe(102);
        expect(getScoreValue(scoresObject, 'sre', 7, 'rawScore')).toBe(75);
      });

      it('should retrieve correct new field values for sre task', () => {
        const scoresObject = {
          percentile: 34,
          standardScore: 82,
          sreScore: 55,
        };

        const grades = [4, 7];
        grades.forEach((grade) => {
          expect(getScoreValue(scoresObject, 'sre', grade, 'percentile')).toBe(34);
          expect(getScoreValue(scoresObject, 'sre', grade, 'percentileDisplay')).toBe(34);
          expect(getScoreValue(scoresObject, 'sre', grade, 'standardScore')).toBe(82);
          expect(getScoreValue(scoresObject, 'sre', grade, 'standardScoreDisplay')).toBe(82);
          expect(getScoreValue(scoresObject, 'sre', grade, 'rawScore')).toBe(55);
        });
      });

      it('should retrieve correct new field values for sre-es task', () => {
        const scoresObject = {
          percentile: 66,
          standardScore: 120,
          sreScore: 85,
        };

        const grades = [3, 6];
        grades.forEach((grade) => {
          expect(getScoreValue(scoresObject, 'sre-es', grade, 'percentile')).toBe(66);
          expect(getScoreValue(scoresObject, 'sre-es', grade, 'percentileDisplay')).toBe(66);
          expect(getScoreValue(scoresObject, 'sre-es', grade, 'standardScore')).toBe(120);
          expect(getScoreValue(scoresObject, 'sre-es', grade, 'standardScoreDisplay')).toBe(120);
          expect(getScoreValue(scoresObject, 'sre-es', grade, 'rawScore')).toBe(85);
        });
      });
    });

    describe('Letter task field mapping', () => {
      it('should retrieve correct field values for letter task', () => {
        const scoresObject = {
          totalPercentCorrect: 85,
          totalCorrect: 76,
        };

        expect(getScoreValue(scoresObject, 'letter', 2, 'percentile')).toBe(85);
        expect(getScoreValue(scoresObject, 'letter', 2, 'percentileDisplay')).toBe(85);
        expect(getScoreValue(scoresObject, 'letter', 2, 'standardScore')).toBe(undefined);
        expect(getScoreValue(scoresObject, 'letter', 2, 'standardScoreDisplay')).toBe(undefined);
        expect(getScoreValue(scoresObject, 'letter', 2, 'rawScore')).toBe(76);
      });

      it('should retrieve correct field values for letter-es task', () => {
        const scoresObject = {
          totalPercentCorrect: 92,
          totalCorrect: 83,
        };

        expect(getScoreValue(scoresObject, 'letter-es', 1, 'percentile')).toBe(92);
        expect(getScoreValue(scoresObject, 'letter-es', 1, 'percentileDisplay')).toBe(92);
        expect(getScoreValue(scoresObject, 'letter-es', 1, 'standardScore')).toBe(undefined);
        expect(getScoreValue(scoresObject, 'letter-es', 1, 'standardScoreDisplay')).toBe(undefined);
        expect(getScoreValue(scoresObject, 'letter-es', 1, 'rawScore')).toBe(83);
      });

      it('should retrieve correct field values for letter-en-ca task', () => {
        const scoresObject = {
          totalPercentCorrect: 78,
          totalCorrect: 70,
        };

        expect(getScoreValue(scoresObject, 'letter-en-ca', 3, 'percentile')).toBe(78);
        expect(getScoreValue(scoresObject, 'letter-en-ca', 3, 'percentileDisplay')).toBe(78);
        expect(getScoreValue(scoresObject, 'letter-en-ca', 3, 'standardScore')).toBe(undefined);
        expect(getScoreValue(scoresObject, 'letter-en-ca', 3, 'standardScoreDisplay')).toBe(undefined);
        expect(getScoreValue(scoresObject, 'letter-en-ca', 3, 'rawScore')).toBe(70);
      });
    });

    describe('Phonics task field mapping', () => {
      it('should retrieve correct field values for phonics task', () => {
        const scoresObject = {
          totalPercentCorrect: 88,
          totalCorrect: 132,
        };

        expect(getScoreValue(scoresObject, 'phonics', 2, 'percentile')).toBe(88);
        expect(getScoreValue(scoresObject, 'phonics', 2, 'percentileDisplay')).toBe(88);
        expect(getScoreValue(scoresObject, 'phonics', 2, 'standardScore')).toBe(88);
        expect(getScoreValue(scoresObject, 'phonics', 2, 'standardScoreDisplay')).toBe(88);
        expect(getScoreValue(scoresObject, 'phonics', 2, 'rawScore')).toBe(132);
      });
    });

    describe('field type validation', () => {
      it('should accept all valid field types', () => {
        const scoresObject = {
          wjPercentile: 75,
          standardScore: 110,
          roarScore: 550,
        };

        const validFieldTypes = [
          'percentile',
          'standardScore',
          'rawScore',
          'percentileDisplay',
          'standardScoreDisplay',
        ];

        validFieldTypes.forEach((fieldType) => {
          expect(() => getScoreValue(scoresObject, 'swr', 3, fieldType)).not.toThrow();
        });
      });

      it('should reject invalid field types', () => {
        const scoresObject = { someField: 100 };
        const invalidFieldTypes = ['invalid', 'wrongType', 'badField', ''];

        invalidFieldTypes.forEach((fieldType) => {
          expect(() => getScoreValue(scoresObject, 'swr', 3, fieldType)).toThrow('Invalid fieldType');
        });
      });
    });
  });

  describe('getRawScoreThreshold', () => {
    describe('old scoring', () => {
      it('should return correct thresholds for swr', () => {
        const result = getRawScoreThreshold('swr');
        expect(result).toEqual({
          above: 550,
          some: 400,
        });
      });

      it('should return correct thresholds for sre', () => {
        const result = getRawScoreThreshold('sre');
        expect(result).toEqual({
          above: 70,
          some: 47,
        });
      });

      it('should return correct thresholds for pa', () => {
        const result = getRawScoreThreshold('pa');
        expect(result).toEqual({
          above: 55,
          some: 45,
        });
      });

      it('should return null thresholds for unknown task', () => {
        const result = getRawScoreThreshold('unknown');
        expect(result).toEqual({
          above: null,
          some: null,
        });
      });
    });

    describe('new scoring', () => {
      it('should return correct thresholds for swr with scoring version 7', () => {
        const result = getRawScoreThreshold('swr', 7);
        expect(result).toEqual({
          above: 513,
          some: 413,
        });
      });

      it('should return correct thresholds for sre with scoring version 4', () => {
        const result = getRawScoreThreshold('sre', 4);
        expect(result).toEqual({
          above: 41,
          some: 23,
        });
      });

      it('should return correct thresholds for swr-es', () => {
        const result = getRawScoreThreshold('swr-es', 1);
        expect(result).toEqual({
          above: 547,
          some: 447,
        });
      });

      it('should return correct thresholds for sre-es', () => {
        const result = getRawScoreThreshold('sre-es', 1);
        expect(result).toEqual({
          above: 25,
          some: 12,
        });
      });
    });
  });

  describe('getRawScoreRange', () => {
    it('should return correct range for swr', () => {
      const result = getRawScoreRange('swr');
      expect(result).toEqual({
        min: 100,
        max: 900,
      });
    });

    it('should return correct range for letter', () => {
      const result = getRawScoreRange('letter');
      expect(result).toEqual({
        min: 0,
        max: 90,
      });
    });

    it('should return correct range for phonics', () => {
      const result = getRawScoreRange('phonics');
      expect(result).toEqual({
        min: 0,
        max: 150,
      });
    });

    it('should return null for unknown task', () => {
      const result = getRawScoreRange('unknown');
      expect(result).toBeNull();
    });
  });

  describe('taskDisplayNames', () => {
    it('should have correct properties for letter task', () => {
      expect(taskDisplayNames.letter).toHaveProperty('name', 'Letter');
      expect(taskDisplayNames.letter).toHaveProperty('publicName', 'ROAR - Letter');
      expect(taskDisplayNames.letter).toHaveProperty('order', 1);
    });
  });

  describe('addElementToPdf', () => {
    it('should add element to PDF and return updated y-counter', async () => {
      const element = document.createElement('div');
      const mockDocument = {
        addPage: vi.fn(),
        addImage: vi.fn(),
      };

      const yCounter = 10;
      const result = await addElementToPdf(element, mockDocument, yCounter);

      expect(mockDocument.addImage).toHaveBeenCalled();
      expect(result).toBeGreaterThan(yCounter);
    });

    it('should add new page if not enough space', async () => {
      const element = document.createElement('div');
      const mockDocument = {
        addPage: vi.fn(),
        addImage: vi.fn(),
      };

      const yCounter = 280; // Close to the 287 threshold
      await addElementToPdf(element, mockDocument, yCounter);

      expect(mockDocument.addPage).toHaveBeenCalled();
    });
  });

  describe('getTagColor', () => {
    it('should return below color for "Needs Extra Support"', () => {
      expect(getTagColor('Needs Extra Support')).toBe(supportLevelColors.below);
    });

    it('should return some color for "Developing Skill"', () => {
      expect(getTagColor('Developing Skill')).toBe(supportLevelColors.some);
    });

    it('should return above color for "Achieved Skill"', () => {
      expect(getTagColor('Achieved Skill')).toBe(supportLevelColors.above);
    });

    it('should handle unexpected values gracefully', () => {
      expect(getTagColor('Unknown')).toBe(supportLevelColors.Assessed);
      expect(getTagColor(null)).toBe(supportLevelColors.Assessed);
      expect(getTagColor(undefined)).toBe(supportLevelColors.Assessed);
    });
  });

  describe('replaceScoreRange', () => {
    it('should return an empty string if text does not exist', () => {
      expect(replaceScoreRange(taskInfoById['hearts-and-flowers']?.desc, 'hearts-ands-flowers')).toBe('');
    });

    it('should return original text if templates do not exist', () => {
      const alpacaDesc = taskInfoById['roam-alpaca']?.desc;
      expect(replaceScoreRange(alpacaDesc, 'roam-alpaca', 5)).toBe(alpacaDesc);
    });

    it('should return original cutoff for swr if scoring version is not 7', () => {
      const swrDesc = replaceScoreRange(taskInfoById['swr']?.desc, 'swr', 6);
      expect(swrDesc).not.toMatch(/{{.*}}/);
      expect(swrDesc).toMatch(/75%/);
    });

    it('should return new cutoff for swr if scoring version is 7', () => {
      const swrDesc = replaceScoreRange(taskInfoById['swr']?.desc, 'swr', 7);
      expect(swrDesc).not.toMatch(/{{.*}}/);
      expect(swrDesc).toMatch(/80%/);
    });

    it('should return new cutoff for sre if scoring version is 4', () => {
      const sreDesc = replaceScoreRange(taskInfoById['sre']?.desc, 'sre', 4);
      expect(sreDesc).not.toMatch(/{{.*}}/);
      expect(sreDesc).toMatch(/80%/);
    });
  });
});
