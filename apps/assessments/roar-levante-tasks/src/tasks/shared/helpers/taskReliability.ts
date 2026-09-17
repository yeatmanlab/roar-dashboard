// @ts-ignore
import { createEvaluateValidity, ValidityEvaluator } from '@bdelab/roar-utils';
import { taskStore } from '../../../taskStore';
import type { TaskReliabilityConfigMap } from '../types/catTypes';

export const TASK_RELIABILITY_CONFIG: TaskReliabilityConfigMap = {
  trog: {
    1: {
      responseTimeLowThreshold: 1500,
      accuracyThreshold: 0.65,
      minResponsesRequired: 10,
      includedReliabilityFlags: ['notEnoughResponses', 'accuracyTooLowAndResponseTimeTooFast'],
      customValidations: [
        {
          logicalOperation: 'and',
          conditions: [
            (data: any) => data.existingFlags.includes('responseTimeTooFast'),
            (data: any) => data.existingFlags.includes('accuracyTooLow'),
          ],
          flag: 'accuracyTooLowAndResponseTimeTooFast',
        },
      ],
    },
  },
  'roar-inference': {
    1: {
      responseTimeLowThreshold: 500,
      accuracyThreshold: 0.5,
      minResponsesRequired: 10,
      includedReliabilityFlags: ['notEnoughResponses', 'accuracyTooLowAndResponseTimeTooFast'],
      customValidations: [
        {
          logicalOperation: 'and',
          conditions: [
            (data: any) => data.existingFlags.includes('responseTimeTooFast'),
            (data: any) => data.existingFlags.includes('accuracyTooLow'),
          ],
          flag: 'accuracyTooLowAndResponseTimeTooFast',
        },
      ],
    },
  },
};

export function createValidityEvaluator(config: Record<string, any>) {
  const { task, scoringVersion } = taskStore();
  const evaluateValidityInput = TASK_RELIABILITY_CONFIG[task]?.[scoringVersion];

  if (!evaluateValidityInput) {
    throw new Error(`No reliability configuration found for task "${task}" version ${scoringVersion}`);
  }

  const evaluateValidity = createEvaluateValidity({
    ...evaluateValidityInput,
  });

  const handleEngagementFlags = (flags: any, reliable: boolean) => {
    if (config.firekit.run.started) {
      return config.firekit?.updateEngagementFlags(flags, reliable);
    }
    return null;
  };

  return new ValidityEvaluator({
    evaluateValidity: evaluateValidity,
    handleEngagementFlags: handleEngagementFlags,
  });
}
