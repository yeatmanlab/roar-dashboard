import { taskStore } from '../../../taskStore';
import { finishExperiment } from '../trials';
import { camelize } from './camelize';
import { PageStateHandler } from './PageStateHandler';

interface TaskMaxTimeConfig {
  [taskName: string]: {
    [version: number]: number;
  };
}

// In minutes
export const TASK_MAX_TIME: TaskMaxTimeConfig = {
  trog: {
    1: 5,
  },
  'roar-inference': {
    1: 10,
  },
};

// This feature allows the task configurator to set a time limit for the app,
// configured via url and store variable maxTime.
// Preload time is not included in the time limit

// buffer in milliseconds after presentation of stimulus to allow some time to answer
const RESPONSE_BUFFER = 2000;

export function getActiveTaskElapsedMs(): number {
  const startTime = taskStore().startTime;
  if (typeof startTime !== 'number') return 0;
  const accumulatedPauseMs = taskStore().taskTimerPausedMs ?? 0;
  const pauseBeganAt = taskStore().taskTimerPauseBeganAt;
  const currentPauseMs = typeof pauseBeganAt === 'number' ? Date.now() - pauseBeganAt : 0;
  return Date.now() - startTime - accumulatedPauseMs - currentPauseMs;
}

export function finalizeCurrentPauseSegment(): void {
  const pauseBeganAt = taskStore().taskTimerPauseBeganAt;
  if (typeof pauseBeganAt !== 'number') return;
  taskStore('taskTimerPausedMs', (taskStore().taskTimerPausedMs ?? 0) + (Date.now() - pauseBeganAt));
  taskStore('taskTimerPauseBeganAt', null);
}

export const startAppTimer = (maxTimeInMinutes: number) => {
  // Minimum time is 1 minute
  const maxTimeInMilliseconds = Math.max(maxTimeInMinutes, 1) * 60000;

  taskStore('startTime', Date.now());
  taskStore('taskTimerPausedMs', 0);
  taskStore('taskTimerPauseBeganAt', null);

  const timerId = setTimeout(() => {
    taskStore('maxTimeReached', true);
    clearTimeout(timerId);
  }, maxTimeInMilliseconds);

  taskStore('taskTimer', timerId);
};

// function for ending the task if the next trial
export async function checkEndTaskEarly(timeRemaining: number, stimAudio: string) {
  const pageStateHandler = new PageStateHandler(stimAudio, false);
  const minTrialDuration = (await pageStateHandler.getStimulusDurationMs()) + RESPONSE_BUFFER;

  if (timeRemaining < minTrialDuration) {
    clearTimeout(taskStore().taskTimer);
    finishExperiment();
  }
}

export function checkMaxTimeExceeded(stimAudio: any) {
  const { task, scoringVersion, maxTime: storeMaxTime } = taskStore();
  // storeMaxTime defaults to 100 if nothing is passed
  const maxTime = TASK_MAX_TIME[task]?.[scoringVersion] ?? storeMaxTime;

  if (maxTime == null) {
    return; // No max time configured, skip check
  }

  const maxTimeInMilliseconds = maxTime * 60000;
  const timeRemaining = maxTimeInMilliseconds - getActiveTaskElapsedMs();
  checkEndTaskEarly(timeRemaining, stimAudio);
}
