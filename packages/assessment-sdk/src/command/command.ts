import type { ParticipantContext } from '../types/participant-context';

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
 * @property auth.refreshToken - Optional. Called on a 401 carrying the `auth/token-expired`
 *   or `auth/token-invalid` error code (once per client for concurrent 401s); the request is
 *   then retried once with the fresh token. Other 401s are surfaced unchanged. Omitted, no
 *   retry happens — `getToken` must then always return a fresh token. A refresh MUST update
 *   the source `getToken` reads from: if `getToken` keeps returning the stale token after a
 *   refresh, every request silently doubles into a 401-refresh-retry cycle.
 * @property participant - Required participant identity context containing participantId
 * @property requestId - Optional function to generate request IDs for tracing
 * @property fetchImpl - Deprecated and never honored: the underlying ts-rest fetcher always
 *   uses the global fetch. Stub the global in tests instead. Slated for removal in the next major.
 * @property logger - Optional logger for debugging and monitoring (token-refresh path included)
 */
export interface CommandContext {
  baseUrl: string;
  auth: {
    getToken(): Promise<string | undefined>;
    refreshToken?(): Promise<string | undefined>;
  };
  participant: ParticipantContext;
  requestId?: () => string;
  /** @deprecated Never honored — the ts-rest fetcher always uses the global fetch. */
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
