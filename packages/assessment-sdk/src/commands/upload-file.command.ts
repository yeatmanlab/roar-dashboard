import { ref, uploadBytesResumable } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';
import type { Command } from '../command/command';
import { UploadStatusEnum } from '../types/upload-file';
import generateFilePath from '../utils/generate-file-path';
import type { UploadFileInput, UploadFileOutput } from '../types/upload-file';

/**
 * Command for uploading a file to Firebase Storage.
 * Allowed file types: .webm, .mp4, .wav, .ogg, .mkv, .mp3.
 *
 * @param participantId - The participant ID.
 * @param storageBucket - The Firebase storage bucket.
 */
export class UploadFileCommand implements Command<UploadFileInput, UploadFileOutput> {
  readonly name = 'upload-file';
  readonly idempotent = false;

  constructor(
    private participantId: string,
    private storageBucket: FirebaseStorage,
  ) {}

  /**
   * Generates a file path and creates an upload task for a file.
   *
   * @param input - The input parameters for the command.
   * @param input.filename - The file name
   * @param input.fileOrBlob - The file or blob to upload
   * @param input.administrationId - The administration ID
   * @param input.runId - The run ID
   * @param input.taskId - The task ID
   * @param input.assessmentPid - Optional assessmentPid. Prioritizes assigned assessmentPid and defaults to assessmentUid
   * @returns A promise that resolves to the upload file output.
   */
  async execute(input: UploadFileInput): Promise<UploadFileOutput> {
    const { filename, fileOrBlob, ...extraMetadata } = input;
    const filePath = generateFilePath({ filename, participantId: this.participantId, ...extraMetadata });

    const storageRef = ref(this.storageBucket, filePath);

    return {
      task: () => uploadBytesResumable(storageRef, fileOrBlob),
      status: UploadStatusEnum.PENDING,
      filename,
      storagePath: storageRef.toString(),
    };
  }
}
