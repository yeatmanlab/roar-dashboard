import { describe, it, expect, vi } from 'vitest';
import type { OpenFgaClient } from '@openfga/sdk';
import { fgaCheck, fgaListObjects, extractFgaObjectId } from './fga-check';

/**
 * Creates a mock FGA client with check and listObjects as vi.fn() stubs.
 * Uses `as unknown as OpenFgaClient` — the SDK's return types include
 * internal `$response` fields we don't need in unit tests.
 */
function createMockFgaClient() {
  return {
    check: vi.fn(),
    listObjects: vi.fn(),
  };
}

type MockFgaClient = ReturnType<typeof createMockFgaClient>;

/** Wraps the mock in a getClient callback for DI. */
const asGetClient = (mock: MockFgaClient) => () => mock as unknown as OpenFgaClient;

describe('fgaCheck', () => {
  it('returns allowed: true when FGA allows the check', async () => {
    const mockClient = createMockFgaClient();
    mockClient.check.mockResolvedValue({ allowed: true });

    const result = await fgaCheck('user-123', 'can_read', 'administration:admin-456', asGetClient(mockClient));

    expect(result).toEqual({ allowed: true });
    expect(mockClient.check).toHaveBeenCalledWith({
      user: 'user:user-123',
      relation: 'can_read',
      object: 'administration:admin-456',
      context: { current_time: expect.any(String) },
    });
  });

  it('returns allowed: false when FGA denies the check', async () => {
    const mockClient = createMockFgaClient();
    mockClient.check.mockResolvedValue({ allowed: false });

    const result = await fgaCheck('user-123', 'can_delete', 'administration:admin-456', asGetClient(mockClient));

    expect(result).toEqual({ allowed: false });
  });

  it('defaults allowed to false when result is undefined', async () => {
    const mockClient = createMockFgaClient();
    mockClient.check.mockResolvedValue({});

    const result = await fgaCheck('user-123', 'can_read', 'administration:admin-456', asGetClient(mockClient));

    expect(result).toEqual({ allowed: false });
  });

  it('passes current_time in ISO format for active_membership condition', async () => {
    const mockClient = createMockFgaClient();
    mockClient.check.mockResolvedValue({ allowed: true });
    const before = new Date().toISOString();

    await fgaCheck('user-123', 'can_read', 'administration:admin-456', asGetClient(mockClient));

    const after = new Date().toISOString();
    const callArgs = mockClient.check.mock.calls[0]![0] as { context: { current_time: string } };
    const passedTime = callArgs.context.current_time;
    expect(passedTime >= before).toBe(true);
    expect(passedTime <= after).toBe(true);
  });
});

describe('fgaListObjects', () => {
  it('returns objects from FGA listObjects', async () => {
    const mockClient = createMockFgaClient();
    mockClient.listObjects.mockResolvedValue({
      objects: ['administration:aaa', 'administration:bbb'],
    });

    const result = await fgaListObjects('user-123', 'can_list', 'administration', asGetClient(mockClient));

    expect(result).toEqual({ objects: ['administration:aaa', 'administration:bbb'] });
    expect(mockClient.listObjects).toHaveBeenCalledWith({
      user: 'user:user-123',
      relation: 'can_list',
      type: 'administration',
      context: { current_time: expect.any(String) },
    });
  });

  it('returns empty array when no objects are accessible', async () => {
    const mockClient = createMockFgaClient();
    mockClient.listObjects.mockResolvedValue({ objects: [] });

    const result = await fgaListObjects('user-123', 'can_list', 'administration', asGetClient(mockClient));

    expect(result).toEqual({ objects: [] });
  });

  it('defaults to empty array when objects is undefined', async () => {
    const mockClient = createMockFgaClient();
    mockClient.listObjects.mockResolvedValue({});

    const result = await fgaListObjects('user-123', 'can_list', 'administration', asGetClient(mockClient));

    expect(result).toEqual({ objects: [] });
  });
});

describe('extractFgaObjectId', () => {
  it('extracts ID from fully qualified FGA object string', () => {
    expect(extractFgaObjectId('administration:abc-123')).toBe('abc-123');
  });

  it('handles UUID format', () => {
    expect(extractFgaObjectId('district:550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('returns empty string for malformed input', () => {
    expect(extractFgaObjectId('no-colon')).toBe('');
  });
});
