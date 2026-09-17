import { TASK_BUCKET_NAMES_DEV, TASK_BUCKET_NAMES_PROD } from './constants';

export function getBucketName(
  taskName: string,
  isDev: boolean,
  assetType: 'audio' | 'visual' | 'corpus',
  language?: string,
  useRoarHfBucket?: boolean,
) {
  // Applies to ROAR hearts-and-flowers only
  if (useRoarHfBucket) {
    return `roar-levante-tasks/${assetType}/${assetType === 'audio' ? language : taskName}`;
  }

  // Hostile-attribution only exists in dev environment
  const bucket =
    isDev || taskName === 'hostile-attribution'
      ? TASK_BUCKET_NAMES_DEV[assetType as keyof typeof TASK_BUCKET_NAMES_DEV]
      : TASK_BUCKET_NAMES_PROD[assetType as keyof typeof TASK_BUCKET_NAMES_PROD];

  return `${bucket}/${assetType === 'audio' ? language : taskName}`;
}
