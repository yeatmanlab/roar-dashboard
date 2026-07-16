import { describe, it, expect } from 'vitest';
import generateFilePath from './generate-file-path';
import { SDKError } from '../errors/sdk-error';

const BASE_INPUT = {
  filename: 'recording.webm',
  administrationId: 'admin-123',
  runId: 'run-456',
  taskId: 'task-789',
  participantId: 'participant-abc',
};

describe('generateFilePath', () => {
  describe('happy path', () => {
    it('returns segments joined by slashes in the correct order', () => {
      const result = generateFilePath(BASE_INPUT);
      expect(result).toBe('task-789/participant-abc/participant-abc/admin-123/run-456/recording.webm');
    });

    it('uses assessmentPid in the pid segment when provided and non-empty', () => {
      const result = generateFilePath({ ...BASE_INPUT, assessmentPid: 'pid-xyz' });
      expect(result).toBe('task-789/participant-abc/pid-xyz/admin-123/run-456/recording.webm');
    });

    it('falls back to participantId when assessmentPid is an empty string', () => {
      const result = generateFilePath({ ...BASE_INPUT, assessmentPid: '' });
      expect(result).toBe('task-789/participant-abc/participant-abc/admin-123/run-456/recording.webm');
    });

    it('falls back to participantId when assessmentPid is omitted', () => {
      const result = generateFilePath(BASE_INPUT);
      expect(result).toBe('task-789/participant-abc/participant-abc/admin-123/run-456/recording.webm');
    });
  });

  describe('allowed file extensions', () => {
    it.each(['.webm', '.mp4', '.wav', '.ogg', '.mkv', '.mp3'])('accepts %s extension', (ext) => {
      expect(() => generateFilePath({ ...BASE_INPUT, filename: `recording${ext}` })).not.toThrow();
    });

    it('accepts extension case-insensitively', () => {
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'recording.WEBM' })).not.toThrow();
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'recording.Mp4' })).not.toThrow();
    });
  });

  describe('file extension validation', () => {
    it('throws SDKError for an unsupported extension', () => {
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'recording.txt' })).toThrow(SDKError);
    });

    it('includes the unsupported extension in the error message', () => {
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'recording.avi' })).toThrow('.avi');
    });

    it('throws SDKError when the filename has no extension', () => {
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'recording' })).toThrow(SDKError);
    });

    it('throws SDKError when the filename is a dotfile with no real extension', () => {
      // A leading dot (e.g. ".webm") is treated as a dotfile, not an extension
      expect(() => generateFilePath({ ...BASE_INPUT, filename: '.webm' })).toThrow(SDKError);
    });

    it('uses the last extension when the filename has multiple dots', () => {
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'my.backup.file.txt' })).toThrow(SDKError);
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'my.audio.track.mp3' })).not.toThrow();
    });

    it('derives extension from the basename when filename includes a path', () => {
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'some/path/recording.webm' })).not.toThrow();
      expect(() => generateFilePath({ ...BASE_INPUT, filename: 'some/path/recording.txt' })).toThrow(SDKError);
    });
  });

  describe('input sanitization', () => {
    it('removes CR/LF characters from segments', () => {
      const result = generateFilePath({ ...BASE_INPUT, taskId: 'task\r\n789' });
      expect(result).toBe('task789/participant-abc/participant-abc/admin-123/run-456/recording.webm');
    });

    it('removes slashes from segments', () => {
      const result = generateFilePath({ ...BASE_INPUT, administrationId: 'admin/123' });
      expect(result).toBe('task-789/participant-abc/participant-abc/admin123/run-456/recording.webm');
    });

    it('removes backslashes from segments', () => {
      const result = generateFilePath({ ...BASE_INPUT, runId: 'run\\456' });
      expect(result).toBe('task-789/participant-abc/participant-abc/admin-123/run456/recording.webm');
    });

    it('removes forbidden characters (?, *, [, ], #, &, =, whitespace)', () => {
      const result = generateFilePath({ ...BASE_INPUT, taskId: 'task?*[]#&= 789' });
      expect(result).toBe('task789/participant-abc/participant-abc/admin-123/run-456/recording.webm');
    });

    it('removes consecutive periods', () => {
      const result = generateFilePath({ ...BASE_INPUT, participantId: 'participant..abc' });
      expect(result).toBe('task-789/participantabc/participantabc/admin-123/run-456/recording.webm');
    });

    it('truncates each segment to 1024 bytes', () => {
      const longId = 'a'.repeat(2000);
      const result = generateFilePath({ ...BASE_INPUT, taskId: longId });
      const segments = result.split('/');
      expect(segments[0]!.length).toBe(1024);
    });

    it('throws SDKError when a segment is empty after sanitization', () => {
      expect(() => generateFilePath({ ...BASE_INPUT, taskId: '???' })).toThrow(SDKError);
      expect(() => generateFilePath({ ...BASE_INPUT, taskId: '???' })).toThrow(
        'Input must be at least 1 character long after sanitization.',
      );
    });
  });
});
