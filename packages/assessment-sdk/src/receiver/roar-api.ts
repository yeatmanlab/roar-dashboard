import type { CommandContext } from '../command/command';

/**
 * RoarApi is the Receiver in the GoF Command pattern.
 * It owns the HTTP client and handles all API communication.
 *
 * Responsibilities:
 * - Manage HTTP requests to the backend API
 * - Inject authentication headers (Bearer token)
 * - Inject request ID headers for tracing
 * - Use custom fetch implementation if provided
 *
 * Note: This is a foundation class. Actual API methods (recordRun, etc.)
 * would be added as the SDK evolves and ts-rest client is integrated.
 */
export class RoarApi {
  private ctx: CommandContext;

  constructor(ctx: CommandContext) {
    this.ctx = ctx;
  }

  /**
   * Makes an HTTP request with automatic header injection.
   *
   * @param endpoint - API endpoint path (e.g., '/api/runs')
   * @param options - Optional RequestInit options (method, body, etc.)
   * @returns Promise<Response> from the fetch call
   *
   * Automatically injects, when values are available:
   * - Authorization header with Bearer token (only if a non-empty token is returned from auth.getToken)
   * - x-request-id header for request tracing (only if the requestId function is defined and returns a value)
   * If the token or requestId are undefined, the corresponding headers are not added.
   */
  async request(endpoint: string, options?: RequestInit): Promise<Response> {
    const url = `${this.ctx.baseUrl}${endpoint}`;
    const token = await this.ctx.auth.getToken();
    const requestId = this.ctx.requestId?.();

    // Build headers with auth and tracing info
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(requestId ? { 'x-request-id': requestId } : {}),
    };

    // Use custom fetch or global fetch
    const fetchImpl = this.ctx.fetchImpl ?? fetch;
    return fetchImpl(url, {
      ...options,
      headers,
    });
  }
}
