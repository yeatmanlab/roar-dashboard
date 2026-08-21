import { taskStore } from '../../../taskStore';

export async function getAssetsPerTask(isDev: boolean, useRoarHfBucket: boolean) {
  try {
    const url = useRoarHfBucket
      ? `https://storage.googleapis.com/roar-levante-tasks/audio/assets-per-task.json`
      : `https://storage.googleapis.com/levante-assets-${isDev ? 'dev' : 'prod'}/audio/assets-per-task.json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const assetsPerTask = await response.json();
    taskStore('assetsPerTask', assetsPerTask);
  } catch (error) {
    console.error('Error fetching JSON:', error);
  }
}
