import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { extractJwt } from './jwt-extractor';

/** Builds a minimal Request carrying only the Authorization header under test. */
function requestWithAuthorization(authorization?: string): Request {
  return { headers: authorization === undefined ? {} : { authorization } } as Request;
}

describe('extractJwt', () => {
  it('extracts the token from a well-formed Bearer header', () => {
    expect(extractJwt(requestWithAuthorization('Bearer <mock-token>'))).toBe('<mock-token>');
  });

  it('accepts the scheme case-insensitively, per RFC 7235', () => {
    expect(extractJwt(requestWithAuthorization('bearer <mock-token>'))).toBe('<mock-token>');
    expect(extractJwt(requestWithAuthorization('BEARER <mock-token>'))).toBe('<mock-token>');
  });

  it('returns undefined when no Authorization header is present', () => {
    expect(extractJwt(requestWithAuthorization())).toBeUndefined();
  });

  // Each of these previously yielded a truncated or wrong-scheme value from
  // `authorization.split(' ')[1]`, which was then forwarded to token verification.
  it.each([
    ['a non-Bearer scheme', 'Basic dXNlcjpwYXNz'],
    ['a scheme that merely starts with Bearer', 'BearerToken <mock-token>'],
    ['extra whitespace-separated segments', 'Bearer token-a token-b'],
    ['a trailing space after the token', 'Bearer <mock-token> '],
    ['two spaces before the token', 'Bearer  <mock-token>'],
    ['the scheme with no credential', 'Bearer'],
    ['the scheme with only a space', 'Bearer '],
    ['a bare token with no scheme', '<mock-token>'],
    ['an empty header', ''],
  ])('returns undefined for %s', (_label, authorization) => {
    expect(extractJwt(requestWithAuthorization(authorization))).toBeUndefined();
  });
});
