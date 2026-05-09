import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { ReadResponse, StreamedListObjectsResponse, TupleKey } from '@openfga/sdk';

/**
 * Typed mock of the OpenFGA client methods used in tests.
 *
 * Uses `Mock` instead of `MockedObject<Pick<...>>` because the FGA SDK wraps
 * every return type in `CallResult<T>` (adds `$response`). Production code never
 * accesses `$response`, so mocks resolve with plain response objects. Using `Mock`
 * avoids the `PromiseResult` type mismatch on `mockResolvedValueOnce` calls.
 */
export interface MockFgaClient {
  writeTuples: Mock;
  deleteTuples: Mock;
  read: Mock;
  check: Mock;
  listObjects: Mock;
  streamedListObjects: Mock;
}

/**
 * Default `streamedListObjects` factory: returns an async generator that yields
 * the configured object IDs (default: none).
 *
 * Tests that need a specific stream can override per-call via
 * `mockStreamedListObjects(client, [...ids])` or `client.streamedListObjects.mockImplementationOnce(...)`.
 */
function makeEmptyStreamedListObjects(): () => AsyncGenerator<StreamedListObjectsResponse> {
  return async function* () {
    // intentionally empty — yields no objects
  };
}

/**
 * Creates a typed mock of the OpenFGA client methods used in tests.
 *
 * Returns the methods the codebase actually calls (`writeTuples`, `deleteTuples`,
 * `read`, `check`, `listObjects`, `streamedListObjects`).
 *
 * `streamedListObjects` defaults to an empty async generator. Use
 * {@link mockStreamedListObjects} to populate per-call results.
 *
 * @returns A mocked FGA client surface
 */
export function createMockFgaClient(): MockFgaClient {
  return {
    writeTuples: vi.fn(),
    deleteTuples: vi.fn(),
    read: vi.fn().mockResolvedValue({ tuples: [], continuation_token: '' }),
    check: vi.fn().mockResolvedValue({ allowed: false }),
    listObjects: vi.fn().mockResolvedValue({ objects: [] }),
    streamedListObjects: vi.fn().mockImplementation(makeEmptyStreamedListObjects()),
  };
}

/**
 * Build a mock FGA read response.
 *
 * The real SDK wraps `ReadResponse` in a `CallResult` that adds `$response`;
 * production code never accesses that property, so the mock omits it.
 *
 * @param tuples - Tuples to include in the response
 * @param continuationToken - Pagination token (empty string = last page)
 * @returns A ReadResponse suitable for mock return values
 */
export function mockReadResponse(tuples: { key: TupleKey; timestamp: string }[], continuationToken = ''): ReadResponse {
  return { tuples, continuation_token: continuationToken } as ReadResponse;
}

/**
 * Set a custom `read` implementation on a mock FGA client.
 *
 * Bridges the type gap between `Promise<ReadResponse>` (what mocks return) and
 * `PromiseResult<ReadResponse>` (what the SDK declares, adding `$response`).
 * Production code never accesses `$response`, so the mismatch is safe.
 *
 * @param client - The mock FGA client
 * @param impl - The implementation callback
 */
export function mockReadImplementation(
  client: MockFgaClient,
  impl: (body: { object?: string } | undefined) => Promise<ReadResponse>,
): void {
  client.read.mockImplementation(impl);
}

/**
 * Configure `streamedListObjects` on a mock FGA client to yield the given
 * object IDs as `StreamedListObjectsResponse` chunks.
 *
 * The configured implementation persists across calls; use
 * `client.streamedListObjects.mockImplementationOnce(...)` for one-shot variants.
 *
 * @param client - The mock FGA client
 * @param objects - Fully-qualified FGA object strings to yield (one per chunk),
 *                  e.g., `['administration:abc', 'administration:def']`
 *
 * @example
 * ```typescript
 * mockStreamedListObjects(mockClient, ['administration:abc', 'administration:def']);
 * const result = await service.listAccessibleObjects('user-123', 'can_read', 'administration');
 * // result === ['administration:abc', 'administration:def']
 * ```
 */
export function mockStreamedListObjects(client: MockFgaClient, objects: string[]): void {
  client.streamedListObjects.mockImplementation(async function* (): AsyncGenerator<StreamedListObjectsResponse> {
    for (const object of objects) {
      yield { object };
    }
  });
}

/**
 * Configure `streamedListObjects` to throw an error during iteration.
 *
 * Useful for testing error wrapping in `AuthorizationService.listAccessibleObjects`
 * and `listAccessibleObjectsStreamed`.
 *
 * @param client - The mock FGA client
 * @param error - The error to throw when the generator is iterated
 */
export function mockStreamedListObjectsError(client: MockFgaClient, error: Error): void {
  // Awaiting a rejected promise throws at runtime, but the compiler can't prove
  // that — so the trailing `yield` is reachable from TypeScript's perspective and
  // we don't need any rule suppressions. The yield never executes in practice.
  client.streamedListObjects.mockImplementation(async function* (): AsyncGenerator<StreamedListObjectsResponse> {
    await Promise.reject(error);
    yield { object: '' };
  });
}
