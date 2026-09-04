import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { FirebaseStorage, StorageReference, UploadTask } from 'firebase/storage';
import { UploadFileCommand } from './upload-file.command';
import { UploadStatusEnum } from '../types/upload-file';
import type { UploadFileInput } from '../types/upload-file';
import { SDKError } from '../errors/sdk-error';

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
}));

vi.mock('../utils/generate-file-path', () => ({
  default: vi.fn(),
}));

const { ref, uploadBytesResumable } = await import('firebase/storage');
const { default: generateFilePath } = await import('../utils/generate-file-path');

const mockRef = ref as Mock;
const mockUploadBytesResumable = uploadBytesResumable as Mock;
const mockGenerateFilePath = generateFilePath as Mock;

describe('UploadFileCommand', () => {
  let command: UploadFileCommand;
  let mockStorageBucket: FirebaseStorage;
  let mockStorageRef: StorageReference;
  let mockUploadTask: UploadTask;

  const participantId = 'participant-123';

  const baseInput: UploadFileInput = {
    filename: 'recording.webm',
    fileOrBlob: new Blob(['audio data'], { type: 'audio/webm' }),
    taskId: 'task-abc',
    runId: 'run-def',
    administrationId: 'admin-ghi',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorageBucket = {} as FirebaseStorage;
    mockUploadTask = {} as UploadTask;

    mockStorageRef = {
      toString: vi
        .fn()
        .mockReturnValue('gs://my-bucket/task-abc/participant-123/participant-123/admin-ghi/run-def/recording.webm'),
    } as unknown as StorageReference;

    mockRef.mockReturnValue(mockStorageRef);
    mockUploadBytesResumable.mockReturnValue(mockUploadTask);
    mockGenerateFilePath.mockReturnValue('task-abc/participant-123/participant-123/admin-ghi/run-def/recording.webm');

    command = new UploadFileCommand(participantId, mockStorageBucket);
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

  it('calls ref with the storage bucket and generated file path', async () => {
    const generatedPath = 'task-abc/participant-123/participant-123/admin-ghi/run-def/recording.webm';
    mockGenerateFilePath.mockReturnValue(generatedPath);

    await command.execute(baseInput);

    expect(mockRef).toHaveBeenCalledWith(mockStorageBucket, generatedPath);
  });

  it('returns pending status, filename, and storagePath', async () => {
    const result = await command.execute(baseInput);

    expect(result.status).toBe(UploadStatusEnum.PENDING);
    expect(result.filename).toBe('recording.webm');
    expect(result.storagePath).toBe(mockStorageRef.toString());
  });

  it('returns an upload function that calls uploadBytesResumable with the storage ref and file', async () => {
    const result = await command.execute(baseInput);

    expect(typeof result.upload).toBe('function');
    expect(mockUploadBytesResumable).not.toHaveBeenCalled();

    const uploadTask = result.upload();

    expect(mockUploadBytesResumable).toHaveBeenCalledWith(mockStorageRef, baseInput.fileOrBlob, undefined);
    expect(uploadTask).toBe(mockUploadTask);
  });

  it('does not call uploadBytesResumable until upload() is invoked', async () => {
    await command.execute(baseInput);

    expect(mockUploadBytesResumable).not.toHaveBeenCalled();
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
