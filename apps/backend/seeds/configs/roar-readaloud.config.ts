/**
 * Seed config for ROAR Read Aloud.
 *
 * Read Aloud is a single-task oral reading fluency assessment. All variants belong
 * to the one readaloud task. Metadata is sourced from the assessment-schema constants.
 *
 * Params match the gameParams from roar-readaloud's serve.js. The `taskName` param,
 * if present, must equal the canonical task ID.
 */
import { readaloud } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { READALOUD_TASK_ID, READALOUD_TASK } = readaloud;

export const readaloudConfig: TaskSeedConfig = {
  tasks: {
    [READALOUD_TASK_ID]: {
      name: READALOUD_TASK.name,
      nameSimple: READALOUD_TASK.nameSimple,
      nameTechnical: READALOUD_TASK.nameTechnical,
    },
  },
  allowedParamKeys: new Set([
    'taskName',
    'testConfigFile',
    'deviceConfigFile',
    'consent',
    'viewType',
    'viewingDistance',
    'bViewingDistancePage',
    'calibrationType',
    'bEyeTracking',
    'visibleEyeTracking',
    'storeAudio',
    'storeVideo',
    'skipInstructions',
    'keyHelpers',
    'practiceCorpus',
    'stimulusCorpus',
    'storyCorpus',
    'sequentialPractice',
    'sequentialStimulus',
    'buttonLayout',
    'numOfPracticeTrials',
    'numberOfTrials',
    'stimulusBlocks',
    'story',
  ]),
  validateVariant(loc, params) {
    if ('taskName' in params && params.taskName !== READALOUD_TASK_ID) {
      throw new Error(`${loc}: "taskName" must be "${READALOUD_TASK_ID}" or omitted`);
    }
  },
};
