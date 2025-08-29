import { describe, it, expect, vi } from 'vitest';
import {
  taskDisplayNames,
  addElementToPdf,
  getSupportLevel,
  getScoreKeys,
  getRawScoreThreshold,
  getRawScoreRange,
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
    it('should return null support level when rawScore is undefined', () => {
      const result = getSupportLevel(3, 50, undefined, 'swr');
      expect(result).toEqual({
        support_level: null,
        tag_color: null,
      });
    });

    it('should return Optional support level when optional is true', () => {
      const result = getSupportLevel(3, 50, 100, 'swr', true);
      expect(result).toEqual({
        support_level: 'Optional',
        tag_color: undefined,
      });
    });

    it('should return Achieved Skill for percentile >= 50 and grade < 6', () => {
      const result = getSupportLevel(3, 75, 100, 'swr');
      expect(result).toEqual({
        support_level: 'Achieved Skill',
        tag_color: 'green',
      });
    });

    it('should return Developing Skill for percentile between 25 and 50', () => {
      const result = getSupportLevel(3, 30, 100, 'swr');
      expect(result).toEqual({
        support_level: 'Developing Skill',
        tag_color: '#edc037',
      });
    });

    it('should return Needs Extra Support for percentile <= 25', () => {
      const result = getSupportLevel(3, 20, 100, 'swr');
      expect(result).toEqual({
        support_level: 'Needs Extra Support',
        tag_color: '#c93d82',
      });
    });

    it('should use raw score thresholds for grade >= 6', () => {
      const result = getSupportLevel(6, undefined, 600, 'swr');
      expect(result).toEqual({
        support_level: 'Achieved Skill',
        tag_color: 'green',
      });
    });
  });

  describe('getScoreKeys', () => {
    it('should return correct keys for swr task', () => {
      const result = getScoreKeys('swr', 3);
      expect(result).toEqual({
        percentileScoreKey: 'wjPercentile',
        percentileScoreDisplayKey: 'wjPercentile',
        standardScoreKey: 'standardScore',
        standardScoreDisplayKey: 'standardScore',
        rawScoreKey: 'roarScore',
      });
    });

    it('should return correct keys for pa task with grade < 6', () => {
      const result = getScoreKeys('pa', 3);
      expect(result).toEqual({
        percentileScoreKey: 'percentile',
        percentileScoreDisplayKey: 'percentile',
        standardScoreKey: 'standardScore',
        standardScoreDisplayKey: 'standardScore',
        rawScoreKey: 'roarScore',
      });
    });

    it('should return correct keys for pa task with grade >= 6', () => {
      const result = getScoreKeys('pa', 6);
      expect(result).toEqual({
        percentileScoreKey: 'sprPercentile',
        percentileScoreDisplayKey: 'sprPercentileString',
        standardScoreKey: 'sprStandardScore',
        standardScoreDisplayKey: 'sprStandardScoreString',
        rawScoreKey: 'roarScore',
      });
    });

    it('should return correct keys for letter task', () => {
      const result = getScoreKeys('letter', 3);
      expect(result).toEqual({
        percentileScoreKey: 'totalPercentCorrect',
        percentileScoreDisplayKey: 'totalPercentCorrect',
        standardScoreKey: undefined,
        standardScoreDisplayKey: undefined,
        rawScoreKey: 'totalCorrect',
      });
    });
  });

  describe('getRawScoreThreshold', () => {
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
});
