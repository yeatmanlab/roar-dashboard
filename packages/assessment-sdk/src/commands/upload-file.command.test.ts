import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { UploadFileCommand } from './upload-file.command';
import { UploadStatusEnum } from '../types/upload-file';
import type { RecordingUploader, UploadFileInput } from '../types/upload-file';
import { SDKError } from '../errors/sdk-error';

vi.mock('../utils/generate-file-path', () => ({
  default: vi.fn(),
}));

const { default: generateFilePath } = await import('../utils/generate-file-path');
const mockGenerateFilePath = generateFilePath as Mock;

describe('UploadFileCommand', () => {
  let command: UploadFileCommand;
  let recordings: RecordingUploader;
  let mockUpload: Mock;

  const participantId = 'participant-123';
  const generatedPath = 'task-abc/participant-123/participant-123/admin-ghi/run-def/recording.webm';

  const baseInput: UploadFileInput = {
    filename: 'recording.webm',
    fileOrBlob: new Blob(['audio data'], { type: 'audio/webm' }),
    taskId: 'task-abc',
    runId: 'run-def',
    administrationId: 'admin-ghi',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUpload = vi.fn().mockResolvedValue(undefined);
    recordings = { bucketUri: 'gs://my-bucket', upload: mockUpload };
    mockGenerateFilePath.mockReturnValue(generatedPath);

    command = new UploadFileCommand(participantId, recordings);
  });

  it('has correct properties', () => {
    expect(command.name).toBe('upload-file');
    expect(command.idempotent).toBe(false);
  });

  it('calls generateFilePath with the correct arguments', async () => {
    await command.execute(baseInput);

    expect(mockGenerateFilePath).toHaveBeenCalledWith({
      filename: 'recording.webm',
      participantId,
      taskId: 'task-abc',
      runId: 'run-def',
      administrationId: 'admin-ghi',
    });
  });

  it('calls generateFilePath with assessmentPid when provided', async () => {
    const input: UploadFileInput = { ...baseInput, assessmentPid: 'custom-pid' };
    await command.execute(input);

    expect(mockGenerateFilePath).toHaveBeenCalledWith({
      filename: 'recording.webm',
      participantId,
      taskId: 'task-abc',
      runId: 'run-def',
      administrationId: 'admin-ghi',
      assessmentPid: 'custom-pid',
    });
  });

  it('returns pending status, filename, and a storagePath composed from the bucket URI', async () => {
    const result = await command.execute(baseInput);

    expect(result.status).toBe(UploadStatusEnum.PENDING);
    expect(result.filename).toBe('recording.webm');
    expect(result.storagePath).toBe(`gs://my-bucket/${generatedPath}`);
  });

  it('does not double the separator when the bucket URI has a trailing slash', async () => {
    command = new UploadFileCommand(participantId, { bucketUri: 'gs://my-bucket/', upload: mockUpload });

    const result = await command.execute(baseInput);

    expect(result.storagePath).toBe(`gs://my-bucket/${generatedPath}`);
  });

  it('returns an upload function that delegates to the host uploader', async () => {
    const result = await command.execute(baseInput);

    expect(typeof result.upload).toBe('function');
    expect(mockUpload).not.toHaveBeenCalled();

    await expect(result.upload()).resolves.toBeUndefined();

    expect(mockUpload).toHaveBeenCalledWith({
      path: generatedPath,
      fileOrBlob: baseInput.fileOrBlob,
    });
  });

  it('forwards customMetadata to the host uploader when provided', async () => {
    const result = await command.execute({ ...baseInput, customMetadata: { trial: '3' } });

    await result.upload();

    expect(mockUpload).toHaveBeenCalledWith({
      path: generatedPath,
      fileOrBlob: baseInput.fileOrBlob,
      customMetadata: { trial: '3' },
    });
  });

  it('does not invoke the host uploader until upload() is called', async () => {
    await command.execute(baseInput);

    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('propagates a rejection from the host uploader', async () => {
    mockUpload.mockRejectedValue(new Error('network down'));

    const result = await command.execute(baseInput);

    await expect(result.upload()).rejects.toThrow('network down');
  });

  it('propagates SDKError thrown by generateFilePath for unsupported file types', async () => {
    mockGenerateFilePath.mockImplementation(() => {
      throw new SDKError('Unsupported file type: ".txt". Allowed: .webm, .mp4, .wav, .ogg, .mkv, .mp3');
    });

    const input: UploadFileInput = { ...baseInput, filename: 'recording.txt' };

    await expect(command.execute(input)).rejects.toThrow(SDKError);
    await expect(command.execute(input)).rejects.toThrow('Unsupported file type');
  });
});
