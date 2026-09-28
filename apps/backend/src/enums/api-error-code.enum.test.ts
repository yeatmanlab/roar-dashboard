import { describe, it, expect } from 'vitest';
import { RefreshableAuthErrorCode } from '@roar-platform/api-contract';
import { ApiErrorCode } from './api-error-code.enum';

describe('ApiErrorCode', () => {
  // The contract re-declares the refreshable auth codes for the clients'
  // 401 refresh-and-retry paths (dashboard and assessment SDK). The backend
  // enum is the source of truth; this parity test turns a rename here into a
  // build failure instead of a silently dead retry path on every client.
  it('matches the refreshable auth error codes published by the api-contract', () => {
    expect(ApiErrorCode.AUTH_TOKEN_EXPIRED).toBe(RefreshableAuthErrorCode.TOKEN_EXPIRED);
    expect(ApiErrorCode.AUTH_TOKEN_INVALID).toBe(RefreshableAuthErrorCode.TOKEN_INVALID);
  });
});
