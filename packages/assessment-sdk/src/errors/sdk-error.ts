/**
 * Options for creating an SDKError.
 * 
 * @property cause - Optional underlying error that caused this SDK error
 * @property code - Optional error code for categorizing errors
 */
export interface SDKErrorOptions {
  cause?: Error | null;
  code?: string;
}

/**
 * SDKError is the custom error class for the Assessment SDK.
 * Extends the native Error class with additional context for debugging.
 * 
 * Used throughout the SDK to provide clear error messages with optional
 * error codes and underlying causes for better error handling and logging.
 * 
 * Example:
 * ```
 * throw new SDKError('Command execution failed', {
 *   code: 'COMMAND_FAILED',
 *   cause: originalError
 * });
 * ```
 */
export class SDKError extends Error {
  public readonly code: string | undefined;
  override readonly cause: Error | null | undefined;
  override readonly name: string;

  constructor(message: string, options: SDKErrorOptions = {}) {
    super(message);
    this.name = 'SDKError';
    this.code = options.code;
    this.cause = options.cause;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SDKError.prototype);
  }
}
