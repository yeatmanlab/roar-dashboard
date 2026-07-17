/**
 * Seed config for ROAR Survey.
 *
 * Survey is a single-task assessment. Each variant represents a different survey
 * instrument, identified by the required `params.survey` string (the GCS filename
 * without the .json extension).
 */
import { survey } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { SURVEY_TASK_ID } = survey;

export const surveyConfig: TaskSeedConfig = {
  tasks: {
    [SURVEY_TASK_ID]: {
      name: 'Survey',
      nameSimple: 'Survey',
      nameTechnical: 'ROAR Survey',
    },
  },
  validateVariant(loc, params) {
    // survey is the GCS filename (without .json) that identifies the instrument
    if (typeof params.survey !== 'string' || (params.survey as string).trim() === '') {
      throw new Error(`${loc}: "params.survey" must be a non-empty string`);
    }
  },
};
