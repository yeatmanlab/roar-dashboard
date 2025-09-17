import { describe, it, expect } from 'vitest';
import { extractJwt } from './jwt-extractor';
import type { Request } from 'express';

describe('extractJwt', () => {
  it('should extract JWT token from Authorization header', () => {
    const req = {
      headers: {
        authorization: 'Bearer <mock-token>',
      },
    } as Request;
    expect(extractJwt(req)).toBe('<mock-token>');
  });

  it('should return undefined if no Authorization header is present', () => {
    const req = {
      headers: {},
    } as Request;
    expect(extractJwt(req)).toBeUndefined();
  });
});
