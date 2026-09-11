import { describe, it, expect } from 'vitest';
import { resolveRoamTaskId } from './variants.js';
import { ROAM_FLUENCY_ARF_TASK_IDS, ROAM_FLUENCY_CALF_TASK_IDS, ROAM_ALPACA_TASK_IDS } from './config.js';

describe('resolveRoamTaskId', () => {
  describe('fluency-arf', () => {
    it('returns ROAM_FLUENCY_ARF_TASK_IDS.EN for English', () => {
      expect(resolveRoamTaskId('fluency-arf', 'en')).toBe(ROAM_FLUENCY_ARF_TASK_IDS.EN);
    });

    it('returns ROAM_FLUENCY_ARF_TASK_IDS.ES for Spanish', () => {
      expect(resolveRoamTaskId('fluency-arf', 'es')).toBe(ROAM_FLUENCY_ARF_TASK_IDS.ES);
    });

    it('returns ROAM_FLUENCY_ARF_TASK_IDS.PT for Portuguese', () => {
      expect(resolveRoamTaskId('fluency-arf', 'pt')).toBe(ROAM_FLUENCY_ARF_TASK_IDS.PT);
    });

    it('is case-insensitive on language code', () => {
      expect(resolveRoamTaskId('fluency-arf', 'ES')).toBe(ROAM_FLUENCY_ARF_TASK_IDS.ES);
    });

    it('falls back to ROAM_FLUENCY_ARF_TASK_IDS.EN for an unknown language', () => {
      expect(resolveRoamTaskId('fluency-arf', 'fr')).toBe(ROAM_FLUENCY_ARF_TASK_IDS.EN);
    });
  });

  describe('fluency-calf', () => {
    it('returns ROAM_FLUENCY_CALF_TASK_IDS.EN for English', () => {
      expect(resolveRoamTaskId('fluency-calf', 'en')).toBe(ROAM_FLUENCY_CALF_TASK_IDS.EN);
    });

    it('returns ROAM_FLUENCY_CALF_TASK_IDS.ES for Spanish', () => {
      expect(resolveRoamTaskId('fluency-calf', 'es')).toBe(ROAM_FLUENCY_CALF_TASK_IDS.ES);
    });

    it('returns ROAM_FLUENCY_CALF_TASK_IDS.PT for Portuguese', () => {
      expect(resolveRoamTaskId('fluency-calf', 'pt')).toBe(ROAM_FLUENCY_CALF_TASK_IDS.PT);
    });

    it('falls back to ROAM_FLUENCY_CALF_TASK_IDS.EN for an unknown language', () => {
      expect(resolveRoamTaskId('fluency-calf', 'it')).toBe(ROAM_FLUENCY_CALF_TASK_IDS.EN);
    });
  });

  describe('roam-alpaca', () => {
    it('returns ROAM_ALPACA_TASK_IDS.EN for English', () => {
      expect(resolveRoamTaskId('roam-alpaca', 'en')).toBe(ROAM_ALPACA_TASK_IDS.EN);
    });

    it('returns ROAM_ALPACA_TASK_IDS.ES for Spanish', () => {
      expect(resolveRoamTaskId('roam-alpaca', 'es')).toBe(ROAM_ALPACA_TASK_IDS.ES);
    });

    it('returns ROAM_ALPACA_TASK_IDS.PT for Portuguese', () => {
      expect(resolveRoamTaskId('roam-alpaca', 'pt')).toBe(ROAM_ALPACA_TASK_IDS.PT);
    });

    it('falls back to ROAM_ALPACA_TASK_IDS.EN for an unknown language', () => {
      expect(resolveRoamTaskId('roam-alpaca', 'fr')).toBe(ROAM_ALPACA_TASK_IDS.EN);
    });
  });

  it('returns the input unchanged for an unrecognized task family', () => {
    expect(resolveRoamTaskId('some-other-task', 'en')).toBe('some-other-task');
  });
});
