import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { ReadResponse, TupleKey } from '@openfga/sdk';

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
}

/**
 * Creates a typed mock of the OpenFGA client methods used in tests.
 *
 * Returns only the methods the codebase actually calls (`writeTuples`, `deleteTuples`,
 * `read`, `check`, `listObjects`).
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
