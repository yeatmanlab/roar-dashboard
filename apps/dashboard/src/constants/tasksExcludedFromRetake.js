import { LEVANTE_TASK_IDS } from './levanteTasks';

const excludedTaskIds = [
  'roar-anb',
  'roar-survey',
  'ran',
  'ran-pt',
  'roav-mep',
  'roav-phonics',
  'crowding',
  'crowding-pt',
];

export const TASKS_EXCLUDED_FROM_RETAKE = [...LEVANTE_TASK_IDS, ...excludedTaskIds];
