import { SDKError } from '../errors/sdk-error';
import type { GenerateFilePathInput } from '../types';

const ALLOWED_EXTENSIONS = new Set(['.webm', '.mp4', '.wav', '.ogg', '.mkv', '.mp3']);

/**
 * Validates the file extension against allowed extensions.
 * @param {string} filename - The file name to validate
 */
const validateFileExtension = (filename: string): void => {
  // Derive extension from the basename (after the last '/' or '\') and
  // ignore a leading dot in the basename (to match path.extname semantics).
  const base = filename.split(/[/\\]/).pop() || '';
  const dotIndex = base.lastIndexOf('.');
  const ext = dotIndex > 0 ? base.slice(dotIndex).toLowerCase() : '';

  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new SDKError(
      `Unsupported file type: "${ext || 'none'}". Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
    );
  }
};

/**
 * Sanitizes input string by removing forbidden characters and truncating to 1024 bytes.
 * @param {string} input - The input string to sanitize
 * @returns Sanitized string
 */
const sanitizeInput = (input: string): string => {
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
    throw new SDKError('Input must be at least 1 character long after sanitization.');
  }

  return sanitized;
};

/**
 * Generates a standardized file path for recordings.
 * @param {string} filename - The file name
 * @param {string} administrationId - The administration ID
 * @param {string} runId - The run ID
 * @param {string} taskId - The task ID
 * @param {string} participantId - The participant ID
 * @param {string} [assessmentPid] - Optional assessmentPid. Prioritizes assigned assessmentPid and defaults to assessmentUid
 * @returns Standardized file path for recordings
 */
export default function generateFilePath({
  filename,
  administrationId,
  runId,
  taskId,
  participantId,
  assessmentPid,
}: GenerateFilePathInput) {
  const pid = assessmentPid && assessmentPid.length > 0 ? assessmentPid : participantId;

  validateFileExtension(filename);

  return [taskId, participantId, pid, administrationId, runId, filename]
    .map((segment) => sanitizeInput(segment))
    .join('/');
}
