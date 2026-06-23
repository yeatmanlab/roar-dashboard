import { describe, it, expect } from 'vitest';
import { SRE_COMPOSITE_FOUNDATIONAL_IRT_PARAMS } from './config.js';
import { COMPOSITE_FOUNDATIONAL_DOMAIN } from '../constants/common-domains.js';

describe('SRE composite_foundational IRT params', () => {
  it('transformation constants are pinned to calibration values', () => {
    expect(SRE_COMPOSITE_FOUNDATIONAL_IRT_PARAMS.TRANSFORMATION_SCALE).toBe(0.0770899);
    expect(SRE_COMPOSITE_FOUNDATIONAL_IRT_PARAMS.TRANSFORMATION_SHIFT).toBe(-3.0328717);
  });

  it('produces expected thetaEstimate for sreScore=20', () => {
    const { TRANSFORMATION_SCALE, TRANSFORMATION_SHIFT } = SRE_COMPOSITE_FOUNDATIONAL_IRT_PARAMS;
    const thetaEstimate = Math.round((20 * TRANSFORMATION_SCALE + TRANSFORMATION_SHIFT) * 10) / 10;
    // 20 × 0.0770899 + (−3.0328717) = 1.541798 − 3.0328717 = −1.4910737
    // Math.round(−14.910737) / 10 = −15 / 10 = −1.5
    expect(thetaEstimate).toBe(-1.5);
  });

  it('TRIAL_TYPE matches COMPOSITE_FOUNDATIONAL_DOMAIN', () => {
    expect(SRE_COMPOSITE_FOUNDATIONAL_IRT_PARAMS.TRIAL_TYPE).toBe(COMPOSITE_FOUNDATIONAL_DOMAIN);
  });
});
