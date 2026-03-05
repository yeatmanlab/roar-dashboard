import type { CommandContext } from '../command/command';
import type { StartRunInput, StartRunOutput } from '../types/start-run';

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

  /**
   * Creates a new assessment run in the ROAR backend.
   *
   * This method sends a POST request to the backend API to initiate a new assessment run.
   * It handles both anonymous and authenticated run modes by conditionally including
   * the administrationId in the request body.
   *
   * The request body includes:
   * - taskVariantId: The variant of the task being assessed
   * - taskVersion: The version of the task
   * - administrationId: (optional) The administration ID for non-anonymous runs
   * - metadata: (optional) Custom metadata for run customization
   *
   * @param input - StartRunInput containing run configuration
   *                - variantId: Task variant identifier
   *                - taskVersion: Task version string
   *                - isAnonymous: Whether the run is anonymous
   *                - administrationId: (required if not anonymous) Administration ID
   *                - metadata: (optional) Custom metadata object
   *
   * @returns Promise<StartRunOutput> containing the newly created runId
   *
   * @throws Error if the API request fails, with details about the HTTP status and response
   *
   * @example
   * ```ts
   * const api = new RoarApi(context);
   * const result = await api.createRun({
   *   type: 'start',
   *   variantId: 'variant-123',
   *   taskVersion: '1.0.0',
   *   isAnonymous: false,
   *   administrationId: 'admin-456',
   *   metadata: { sessionId: 'session-789' }
   * });
   * console.log(result.runId); // 'run-xyz'
   * ```
   */
  async createRun(input: StartRunInput): Promise<StartRunOutput> {
    const body: Record<string, unknown> = {
      taskVariantId: input.variantId,
      taskVersion: input.taskVersion,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    if (!input.isAnonymous) {
      body.administrationId = input.administrationId;
    }

    const res = await this.request('/v1/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`createRun failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { runId: string };
    return { runId: data.runId };
  }
}
