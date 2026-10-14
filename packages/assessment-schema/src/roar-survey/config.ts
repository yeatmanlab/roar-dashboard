export const SURVEY_TASK_ID = 'roar-survey' as const;

export type SurveyTaskId = typeof SURVEY_TASK_ID;

/**
 * Suffix for this assessment's artifact bucket. See `artifact-buckets.ts` for how the backend composes
 * the full name, and why the suffix is declared separately from the task IDs above.
 */
export const SURVEY_ARTIFACT_BUCKET_SUFFIX = 'survey' as const;
