import type { Command } from '../command/command';
import { UploadStatusEnum } from '../types/upload-file';
import generateFilePath from '../utils/generate-file-path';
import type { RecordingUploader, UploadFileInput, UploadFileOutput } from '../types/upload-file';

/**
 * Strips trailing slashes from a host-supplied bucket URI.
 *
 * `storagePath` is persisted on the trial and parsed by downstream tooling, so a host that
 * passes `gs://bucket/` must not produce `gs://bucket//task/...`. Named for exactly what it
 * does, because the harness has a `normalizeBucketUri` that also *validates* and disables
 * uploads on a bad URI — something the SDK can't do, since any consumer may implement
 * `RecordingUploader` itself. These are not two copies of one helper.
 *
 * @param bucketUri - Bucket URI as supplied by the host
 * @returns The URI without trailing slashes
 */
function stripTrailingSlashes(bucketUri: string): string {
  return bucketUri.replace(/\/+$/, '');
}

/**
 * Command for uploading a recording through the host-supplied {@link RecordingUploader}.
 * Allowed file types: .webm, .mp4, .wav, .ogg, .mkv, .mp3.
 *
 * The command owns the path convention; the host owns the transport. It deliberately does not
 * take a storage-client handle — see {@link RecordingUploader} for why.
 *
 * @param participantId - The participant ID.
 * @param recordings - The host-supplied storage capability.
 */
export class UploadFileCommand implements Command<UploadFileInput, UploadFileOutput> {
  readonly name = 'upload-file';
  readonly idempotent = false;

  constructor(
    private participantId: string,
    private recordings: RecordingUploader,
  ) {}

  /**
   * Generates a file path and returns a deferred upload for the queue to drive.
   *
   * The bytes do not move until the returned `upload()` is called — the facade's queue owns
   * when that happens (see `_processUploadQueue`). `storagePath` is resolved eagerly so the
   * caller can persist it on the trial without waiting for the upload to finish.
   *
   * @param input - The input parameters for the command.
   * @param input.filename - The file name
   * @param input.fileOrBlob - The file or blob to upload
   * @param input.administrationId - The administration ID
   * @param input.runId - The run ID
   * @param input.taskId - The task ID
   * @param input.assessmentPid - Optional assessmentPid. Prioritizes assigned assessmentPid and defaults to assessmentUid
   * @param input.customMetadata - Optional custom metadata to attach to the file.
   * @returns A promise that resolves to the upload file output.
   */
  async execute(input: UploadFileInput): Promise<UploadFileOutput> {
    const { filename, fileOrBlob, customMetadata, ...extraMetadata } = input;
    const path = generateFilePath({ filename, participantId: this.participantId, ...extraMetadata });

    return {
      upload: () => this.recordings.upload({ path, fileOrBlob, ...(customMetadata ? { customMetadata } : {}) }),
      status: UploadStatusEnum.PENDING,
      filename,
      storagePath: `${stripTrailingSlashes(this.recordings.bucketUri)}/${path}`,
    };
  }
}
