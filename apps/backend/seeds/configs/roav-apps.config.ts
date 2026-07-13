import { roavApps } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { ROAV_MP_TASK_ID, ROAV_RVP_TASK_ID } = roavApps;

const KNOWN_TASK_IDS = new Set([ROAV_MP_TASK_ID, ROAV_RVP_TASK_ID]);

export const roavAppsConfig: TaskSeedConfig = {
  tasks: {
    [ROAV_MP_TASK_ID]: {
      name: 'Motion Perception',
      nameSimple: 'Motion Perception',
      nameTechnical: 'Rapid Online Assessment of Vision — Motion Perception',
    },
    [ROAV_RVP_TASK_ID]: {
      name: 'Rapid Visual Processing',
      nameSimple: 'RVP',
      nameTechnical: 'Rapid Online Assessment of Vision — Rapid Visual Processing',
    },
  },
  resolveTaskId(params) {
    const taskName = params.taskName as string | undefined;
    if (!taskName) throw new Error('"taskName" is required in params for roav-apps');
    if (!KNOWN_TASK_IDS.has(taskName)) {
      throw new Error(`Unknown roav-apps taskName "${taskName}". Known: ${[...KNOWN_TASK_IDS].join(', ')}`);
    }
    return taskName;
  },
};
