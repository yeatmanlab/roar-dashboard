import type { UploadTask } from 'firebase/storage'
/**
 * Input for UploadFile command.
 *
 * @property filename - The name of the file to upload
 * @property fileOrBlob - The file or blob to upload
 * @property taskId - The task ID. Used as part of the storage path.
 * @property runId - The run ID. Used as part of the storage path.
 * @property administrationId - The administration ID. Used as part of the storage path.
 * @property assessmentPid - Optional assessment PID. Used as part of the storage path. Defaults to participantId.
 * @property customMetadata - Optional custom metadata to attach to the file.
 */
export interface UploadFileInput {
  filename: string;
  fileOrBlob: File | Blob;
  taskId: string;
  runId: string;
  administrationId: string;
  assessmentPid?: string;
  customMetadata?: Record<string, any>;
}

/**
 * Input for GenerateFilePath function.
 *
 * @property filename - The name of the file to upload
 * @property taskId - The task ID. Used as part of the storage path.
 * @property participantId - The participant ID. Used as part of the storage path.
 * @property runId - The run ID. Used as part of the storage path.
 * @property administrationId - The administration ID. Used as part of the storage path.
 * @property assessmentPid - Optional assessment PID. Used as part of the storage path. Defaults to participantId.
 */
export interface GenerateFilePathInput {
  filename: string;
  taskId: string;
  participantId: string;
  runId: string;
  administrationId: string;
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
 * @property task - Optional upload task function that calls uploadBytesResumable. Absent for local saves.
 * @property status - The status of the upload
 * @property filename - The name of the file to upload
 * @property storagePath - Storage path of the file. Firebase storage path including bucket name, or local file path.
 */
export type UploadFileOutput = {
  task?: () => UploadTask;
  status: UploadStatus;
  filename: string;
  storagePath: string;
}