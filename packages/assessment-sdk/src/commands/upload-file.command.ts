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
    private storageBucket?: FirebaseStorage
  ) {}

  /**
   * Stores a file locally for testing or browser environments.
   * 
   * @param file - The file or blob to store
   * @param filePath - The file path to store the file at
   */
  private async storeLocal(file: File | Blob, filePath: string): Promise<void> {
    if (typeof window === 'undefined') {
      // Node.js / Vitest
      const { writeFile, mkdir } = await import('fs/promises');
      const { join, dirname } = await import('path');

      const outputPath = join(process.cwd(), 'tmp', filePath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, Buffer.from(await file.arrayBuffer()));
    } else {
      // Browser
      const filename = filePath.split('/').pop() ?? filePath;
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

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

    if (!this.storageBucket) {
      await this.storeLocal(fileOrBlob, filePath);
      return {
        task: undefined,
        status: UploadStatusEnum.COMPLETED,
        filename,
        storagePath: filePath,
      };
    }

    const storageRef = ref(this.storageBucket, filePath);
    
    return {
      task: () => uploadBytesResumable(storageRef, fileOrBlob),
      status: UploadStatusEnum.PENDING,
      filename,
      storagePath: storageRef.toString(),
    };
  }
}