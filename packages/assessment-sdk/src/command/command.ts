/**
 * Logger interface for SDK observability.
 * Allows host applications to integrate their own logging solution (Winston, Pino, console, etc.)
 */
export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * CommandContext provides SDK configuration and runtime dependencies.
 * 
 * @property baseUrl - API base URL for all requests
 * @property auth - Authentication callbacks for token management
 * @property auth.getToken - Retrieves current auth token (called before each request)
 * @property auth.refreshToken - Optional token refresh callback (called on 401 Unauthorized)
 * @property requestId - Optional function to generate request IDs for tracing
 * @property fetchImpl - Optional custom fetch implementation (defaults to global fetch)
 * @property logger - Optional logger for debugging and monitoring
 */
export interface CommandContext {
  baseUrl: string;
  auth: {
    getToken(): Promise<string | undefined>;
    refreshToken?(): Promise<string | undefined>;
  };
  requestId?: () => string;
  fetchImpl?: typeof fetch;
  logger?: Logger;
}

/**
 * Command interface following the GoF Command pattern.
 * Each command represents a single operation that can be executed with retry logic.
 * 
 * @template TInput - Input type for the command
 * @template TOutput - Output type returned by execute()
 * @property name - Unique command identifier for logging and debugging
 * @property idempotent - If true, Invoker will retry on failure; if false, no retries
 * @property execute - Executes the command with given input, returns Promise<TOutput>
 */
export interface Command<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly idempotent: boolean;
  execute(input: TInput): Promise<TOutput>;
}
