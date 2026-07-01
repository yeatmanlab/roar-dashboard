import { ref, uploadBytesResumable } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';
import type { Command } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import { UploadStatusEnum } from '../types/upload-file';
import type { UploadFileInput, GenerateFilePathInput, UploadFileOutput } from '../types/upload-file';

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
  
  private readonly ALLOWED_EXTENSIONS = new Set(['.webm', '.mp4', '.wav', '.ogg', '.mkv', '.mp3']);

  /**
   * Validates the file extension against allowed extensions.
   * @param {string} filename - The file name to validate
   */
  private validateFileExtension(filename: string): void {
  // Derive extension from the basename (after the last '/' or '\') and
  // ignore a leading dot in the basename (to match path.extname semantics).
  const base = filename.split(/[/\\]/).pop() || '';
  const dotIndex = base.lastIndexOf('.');
  const ext = dotIndex > 0 ? base.slice(dotIndex).toLowerCase() : '';

    if (!ext || !this.ALLOWED_EXTENSIONS.has(ext)) {
      throw new SDKError(`Unsupported file type: "${ext || 'none'}". Allowed: ${Array.from(this.ALLOWED_EXTENSIONS).join(', ')}`);
    }
  }

  /**
   * Sanitizes input string by removing forbidden characters and truncating to 1024 bytes.
   * @param {string} input - The input string to sanitize
   * @returns Sanitized string
   */
  private sanitizeInput(input: string): string {
  let sanitized = input
    .replace(/[\r\n]/g, '') // Remove CR/LF
    .replace(/[/\\]\.(?=[a-zA-Z])/g, '') // Remove periods after slash and before letter
    .replace(/[/\\]+/g, '') // Remove all remaining slashes
    .replace(/[?*[\]#&=\s\v\f]+/g, '') // Remove forbidden characters
    .replace(/\.{2,}/g, ''); // Remove consecutive periods

    // Truncate to 1024 bytes safely
    const encoder = new TextEncoder();
    let encoded = encoder.encode(sanitized);
    if (encoded.length > 1024) {
      encoded = encoded.slice(0, 1024);
      sanitized = new TextDecoder().decode(encoded);
    }

    if (sanitized.length === 0) {
      throw new Error('Input must be at least 1 character long after sanitization.');
    }

    return sanitized;
  };

  /**
   * Generates a standardized file path for recordings.
   * @param {string} filename - The file name
   * @param {string} administrationId - The administration ID
   * @param {string} runId - The run ID
   * @param {string} taskId - The task ID
   * @param {string} [assessmentPid] - Optional assessmentPid. Prioritizes assigned assessmentPid and defaults to assessmentUid
   * @returns Standardized file path for recordings
   */
  private generateFilePath({ filename, administrationId , runId, taskId, assessmentPid }: GenerateFilePathInput) {
    const pid = (assessmentPid && assessmentPid.length > 0) ? assessmentPid : this.participantId;

    this.validateFileExtension(filename);

    return [taskId, this.participantId, pid, administrationId, runId, filename].map((segment) => this.sanitizeInput(segment)).join('/');
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
    const filePath = this.generateFilePath({ filename, ...extraMetadata });

    const storageRef = ref(this.storageBucket, filePath);
    
    return {
      task: () => uploadBytesResumable(storageRef, fileOrBlob),
      status: UploadStatusEnum.PENDING,
      filename,
      storagePath: storageRef.toString(),
    };
  }
}