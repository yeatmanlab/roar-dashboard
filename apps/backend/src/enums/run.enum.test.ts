import { describe, it, expect } from 'vitest';
import { AssessmentStageSchema, RunTrialInteractionEventSchema } from '@roar-dashboard/api-contract';
import { assessmentStageEnum, trialInteractionTypeEnum } from '../db/schema/enums';
import { AssessmentStage, TrialInteractionType } from './run.enum';

describe('Run enums', () => {
  describe('AssessmentStage', () => {
    it('should have correct constant keys', () => {
      expect(AssessmentStage).toHaveProperty('PRACTICE');
      expect(AssessmentStage).toHaveProperty('TEST');
    });

    it('should map keys to correct values', () => {
      expect(AssessmentStage.PRACTICE).toBe('practice');
      expect(AssessmentStage.TEST).toBe('test');
    });

    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(assessmentStageEnum.enumValues);
      const contractValues = new Set(AssessmentStageSchema.options);

      expect(backendValues).toEqual(contractValues);
    });

    it('should have correct type definition', () => {
      const practice: AssessmentStage = 'practice';
      const test: AssessmentStage = 'test';

      expect(practice).toBe('practice');
      expect(test).toBe('test');
    });
  });

  describe('TrialInteractionType', () => {
    it('should have correct constant keys', () => {
      expect(TrialInteractionType).toHaveProperty('FOCUS');
      expect(TrialInteractionType).toHaveProperty('BLUR');
      expect(TrialInteractionType).toHaveProperty('FULLSCREEN_ENTER');
      expect(TrialInteractionType).toHaveProperty('FULLSCREEN_EXIT');
    });

    it('should map keys to correct values', () => {
      expect(TrialInteractionType.FOCUS).toBe('focus');
      expect(TrialInteractionType.BLUR).toBe('blur');
      expect(TrialInteractionType.FULLSCREEN_ENTER).toBe('fullscreen_enter');
      expect(TrialInteractionType.FULLSCREEN_EXIT).toBe('fullscreen_exit');
    });

    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(trialInteractionTypeEnum.enumValues);
      const contractValues = new Set(RunTrialInteractionEventSchema.options);

      expect(backendValues).toEqual(contractValues);
    });

    it('should have correct type definition', () => {
      const focus: TrialInteractionType = 'focus';
      const blur: TrialInteractionType = 'blur';
      const fullscreenEnter: TrialInteractionType = 'fullscreen_enter';
      const fullscreenExit: TrialInteractionType = 'fullscreen_exit';

      expect(focus).toBe('focus');
      expect(blur).toBe('blur');
      expect(fullscreenEnter).toBe('fullscreen_enter');
      expect(fullscreenExit).toBe('fullscreen_exit');
    });
  });
});
