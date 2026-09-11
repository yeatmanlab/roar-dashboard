import { describe, it, expect } from 'vitest';
import { parseIrtHyperparams, createScaleTheta, clampPositive } from './clowderSetup';
import type { IrtHyperparamsRow } from '../types/catTypes';

describe('parseIrtHyperparams', () => {
  it('should parse single hyperparameter row without trial_type and default to "composite"', () => {
    const input: IrtHyperparamsRow[] = [
      {
        'theta.min': -4,
        'theta.max': 4,
        'theta.mean': 0,
        'theta.sd': 1,
        'transformation.scale': 100,
        'transformation.shift': 500,
      },
    ];

    const result = parseIrtHyperparams(input);

    expect(result).toEqual({
      composite: {
        minTheta: -4,
        maxTheta: 4,
        priorPar: [0, 1],
        transformationScale: 100,
        transformationShift: 500,
      },
    });
  });

  it('should parse multiple hyperparameter rows with trial_type', () => {
    const input: IrtHyperparamsRow[] = [
      {
        trial_type: 'composite',
        'theta.min': -4,
        'theta.max': 4,
        'theta.mean': 0,
        'theta.sd': 1,
        'transformation.scale': 100,
        'transformation.shift': 500,
      },
      {
        trial_type: 'new',
        'theta.min': -3,
        'theta.max': 3,
        'theta.mean': 0.5,
        'theta.sd': 1.2,
        'transformation.scale': 50,
        'transformation.shift': 250,
      },
    ];

    const result = parseIrtHyperparams(input);

    expect(result).toEqual({
      composite: {
        minTheta: -4,
        maxTheta: 4,
        priorPar: [0, 1],
        transformationScale: 100,
        transformationShift: 500,
      },
      new: {
        minTheta: -3,
        maxTheta: 3,
        priorPar: [0.5, 1.2],
        transformationScale: 50,
        transformationShift: 250,
      },
    });
  });

  it('should lowercase trial_type keys', () => {
    const input: IrtHyperparamsRow[] = [
      {
        trial_type: 'COMPOSITE_COMPREHENSION',
        'theta.min': -4,
        'theta.max': 4,
        'theta.mean': 0,
        'theta.sd': 1,
        'transformation.scale': 100,
        'transformation.shift': 500,
      },
    ];

    const result = parseIrtHyperparams(input);

    expect(result).toHaveProperty('composite_comprehension');
    expect(result).not.toHaveProperty('COMPOSITE_COMPREHENSION');
  });

  it('should throw error when multiple rows exist without trial_type column', () => {
    const input: IrtHyperparamsRow[] = [
      {
        'theta.min': -4,
        'theta.max': 4,
        'theta.mean': 0,
        'theta.sd': 1,
        'transformation.scale': 100,
        'transformation.shift': 500,
      },
      {
        'theta.min': -3,
        'theta.max': 3,
        'theta.mean': 0.5,
        'theta.sd': 1.2,
        'transformation.scale': 50,
        'transformation.shift': 250,
      },
    ];

    expect(() => parseIrtHyperparams(input)).toThrow(
      'Multiple hyperparameter rows found but no trial_type column found',
    );
  });

  it('should handle numeric string values from CSV', () => {
    const input: IrtHyperparamsRow[] = [
      {
        'theta.min': -4,
        'theta.max': 4,
        'theta.mean': 0,
        'theta.sd': 1,
        'transformation.scale': 100,
        'transformation.shift': 500,
      },
    ];

    const result = parseIrtHyperparams(input);

    expect(typeof result.composite.minTheta).toBe('number');
    expect(typeof result.composite.maxTheta).toBe('number');
    expect(typeof result.composite.transformationScale).toBe('number');
    expect(typeof result.composite.transformationShift).toBe('number');
  });
});

describe('clampPositive', () => {
  it('should return Number.MIN_VALUE for NaN', () => {
    expect(clampPositive(NaN)).toBe(Number.MIN_VALUE);
  });

  it('should return Number.MIN_VALUE for zero', () => {
    expect(clampPositive(0)).toBe(Number.MIN_VALUE);
  });

  it('should return Number.MIN_VALUE for negative values', () => {
    expect(clampPositive(-1)).toBe(Number.MIN_VALUE);
    expect(clampPositive(-100)).toBe(Number.MIN_VALUE);
    expect(clampPositive(-0.001)).toBe(Number.MIN_VALUE);
  });

  it('should return the value unchanged for positive values within range', () => {
    expect(clampPositive(1)).toBe(1);
    expect(clampPositive(100)).toBe(100);
    expect(clampPositive(0.001)).toBe(0.001);
  });

  it('should clamp extremely large values to Number.MAX_VALUE', () => {
    expect(clampPositive(Number.MAX_VALUE * 2)).toBe(Number.MAX_VALUE);
    expect(clampPositive(Infinity)).toBe(Number.MAX_VALUE);
  });

  it('should handle Number.MIN_VALUE (smallest positive) correctly', () => {
    expect(clampPositive(Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
  });
});

describe('createScaleTheta', () => {
  const mockHyperparams = {
    composite: {
      minTheta: -4,
      maxTheta: 4,
      priorPar: [0, 1],
      transformationScale: 100,
      transformationShift: 500,
    },
    new: {
      minTheta: -3,
      maxTheta: 3,
      priorPar: [0, 1],
      transformationScale: 50,
      transformationShift: 250,
    },
  };

  it('should apply scale and shift transformation to theta', () => {
    const scaleTheta = createScaleTheta(mockHyperparams);
    const result = scaleTheta(1.5, 0.3, 'composite');

    // thetaScaled = 1.5 * 100 + 500 = 650
    expect(result.thetaEstimate).toBe(650);
  });

  it('should apply absolute value of scale to standard error', () => {
    const scaleTheta = createScaleTheta(mockHyperparams);
    const result = scaleTheta(1.5, 0.3, 'composite');

    // thetaSEScaled = 0.3 * abs(100) = 30
    expect(result.thetaSE).toBe(30);
  });

  it('should handle negative transformation scale correctly', () => {
    const hyperparamsWithNegativeScale = {
      composite: {
        minTheta: -4,
        maxTheta: 4,
        priorPar: [0, 1],
        transformationScale: -100,
        transformationShift: 500,
      },
    };

    const scaleTheta = createScaleTheta(hyperparamsWithNegativeScale);
    const result = scaleTheta(1.5, 0.3, 'composite');

    // thetaScaled = 1.5 * -100 + 500 = 350
    expect(result.thetaEstimate).toBe(350);
    // thetaSEScaled = 0.3 * abs(-100) = 30 (SE is always positive)
    expect(result.thetaSE).toBe(30);
  });

  it('should use composite as default when cat is not found', () => {
    const scaleTheta = createScaleTheta(mockHyperparams);
    const result = scaleTheta(1.0, 0.2, 'nonexistent');

    // Should use composite hyperparams
    expect(result.thetaEstimate).toBe(600); // 1.0 * 100 + 500
    expect(result.thetaSE).toBe(20); // 0.2 * 100
  });

  it('should use composite as default when cat is undefined', () => {
    const scaleTheta = createScaleTheta(mockHyperparams);
    const result = scaleTheta(1.0, 0.2);

    // Should use composite hyperparams
    expect(result.thetaEstimate).toBe(600);
    expect(result.thetaSE).toBe(20);
  });

  it('should select correct hyperparams for specified cat', () => {
    const scaleTheta = createScaleTheta(mockHyperparams);
    const result = scaleTheta(2.0, 0.4, 'new');

    // Should use 'new' hyperparams: 2.0 * 50 + 250 = 350
    expect(result.thetaEstimate).toBe(350);
    expect(result.thetaSE).toBe(20); // 0.4 * 50
  });

  it('should clamp negative thetaSE to Number.MIN_VALUE', () => {
    const scaleTheta = createScaleTheta(mockHyperparams);
    const result = scaleTheta(1.0, -0.5, 'composite');

    // Negative SE should be clamped
    expect(result.thetaSE).toBe(Number.MIN_VALUE);
  });

  it('should clamp NaN thetaSE to Number.MIN_VALUE', () => {
    const scaleTheta = createScaleTheta(mockHyperparams);
    const result = scaleTheta(1.0, NaN, 'composite');

    expect(result.thetaSE).toBe(Number.MIN_VALUE);
  });

  it('should handle zero theta and SE', () => {
    const scaleTheta = createScaleTheta(mockHyperparams);
    const result = scaleTheta(0, 0, 'composite');

    expect(result.thetaEstimate).toBe(500); // 0 * 100 + 500
    expect(result.thetaSE).toBe(Number.MIN_VALUE); // 0 is clamped
  });

  it('should handle fractional scale and shift', () => {
    const fractionalHyperparams = {
      composite: {
        minTheta: -4,
        maxTheta: 4,
        priorPar: [0, 1],
        transformationScale: 0.5,
        transformationShift: 0.25,
      },
    };

    const scaleTheta = createScaleTheta(fractionalHyperparams);
    const result = scaleTheta(2.0, 0.8, 'composite');

    expect(result.thetaEstimate).toBe(1.25); // 2.0 * 0.5 + 0.25
    expect(result.thetaSE).toBe(0.4); // 0.8 * 0.5
  });
});
