import { taskStore } from '../../../taskStore';
import { CLOWDER_CONFIG } from './clowderSetup';

export const shouldUseClowder = (): boolean => {
  const { task, scoringVersion, isRoarApp } = taskStore();
  const taskConfig = CLOWDER_CONFIG[task];

  // Use Clowder if ROAR app and task supports Clowder
  // Normed tasks without scoringVersion will default to original item selection and scoring
  return Boolean(isRoarApp && taskConfig?.[scoringVersion]);
};
