import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { OpenFgaClient, ReadResponse, TupleKey } from '@openfga/sdk';

/** The subset of OpenFgaClient methods used by AuthorizationService and AuthorizationModule. */
type FgaClientTestSurface = Pick<OpenFgaClient, 'writeTuples' | 'deleteTuples' | 'read' | 'check' | 'listObjects'>;

/**
 * Creates a typed mock of the OpenFGA client methods used in tests.
 *
 * Returns only the methods the codebase actually calls (`writeTuples`, `deleteTuples`, `read`),
 * typed via `Pick` so tests get full IntelliSense without an `as unknown as` cast.
 *
 * @returns A mocked FGA client surface
 */
export function createMockFgaClient(): MockedObject<FgaClientTestSurface> {
  return {
    writeTuples: vi.fn(),
    deleteTuples: vi.fn(),
    read: vi.fn().mockResolvedValue({ tuples: [], continuation_token: '' }),
    check: vi.fn().mockResolvedValue({ allowed: false }),
    listObjects: vi.fn().mockResolvedValue({ objects: [] }),
  };
}

export type MockFgaClient = ReturnType<typeof createMockFgaClient>;

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
  // @ts-expect-error - mock omits $response wrapper from FGA SDK CallResult type
  client.read.mockImplementation(impl);
}
