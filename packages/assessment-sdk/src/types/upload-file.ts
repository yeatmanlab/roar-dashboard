import type { UploadTask } from 'firebase/storage'
/**
 * Input for UploadFile command.
 * 
 * @property administrationId - The administration ID. Used as part of the bucket path.
 * @property filename - The name of the file to upload
 * @property fileOrBlob - The file or blob to upload
 * @property runId - The run ID. Used as part of the bucket path.
 * @property taskId - The task ID. Used as part of the bucket path.
 * @property assessmentPid - The assessment PID. Used as part of the bucket path. (optional, otherwise set to participant)
 * @property customMetadata - Custom metadata to attach to the file (optional)
 */
export interface UploadFileInput {
  administrationId: string;
  filename: string;
  fileOrBlob: File | Blob;
  runId: string;
  taskId: string;
  assessmentPid?: string;
  customMetadata?: Record<string, any>;
}

/**
 * Input for GenerateFilePath function.
 * 
 * @property administrationId - The administration ID. Used as part of the bucket path.
 * @property filename - The name of the file to upload
 * @property runId - The run ID. Used as part of the bucket path.
 * @property taskId - The task ID. Used as part of the bucket path.
 * @property participantId - The participant ID. Used as part of the bucket path.
 * @property assessmentPid - The assessment PID. Used as part of the bucket path. (optional, otherwise set to participant)
 */
export interface GenerateFilePathInput {
  administrationId: string;
  filename: string;
  runId: string;
  taskId: string;
  participantId: string;
  assessmentPid?: string;
}

/**
 * Enum for upload statuses. Used for queue management.
 */
export const UploadStatusEnum = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type UploadStatus = typeof UploadStatusEnum[keyof typeof UploadStatusEnum];

/**
 * Represents the output of an upload file command.
 * 
 * @property task - The upload task function that calls uploadBytesResumable.
 * @property status - The status of the upload
 * @property filename - The name of the file to upload
 * @property storagePath - Firebase storage path of the file, including bucket name.
 */
export type UploadFileOutput = {
  task: () => UploadTask;
  status: UploadStatus;
  filename: string;
  storagePath: string;
}