import type { Request } from 'express';

/**
 * Matches an `Authorization` header carrying exactly one `Bearer` credential.
 *
 * The scheme name is case-insensitive per RFC 7235, but the credential itself must be a
 * single run of non-whitespace: a header like `Bearer a b` is malformed rather than a
 * token of `a`, and a non-Bearer scheme such as `Basic` carries no JWT to extract.
 */
const BEARER_TOKEN_PATTERN = /^Bearer (\S+)$/i;

/**
 * Extracts the JWT token from the Authorization header.
 *
 * Returns undefined for anything that is not a well-formed `Bearer <token>` header, so the
 * caller rejects a malformed credential instead of forwarding a truncated or wrong-scheme
 * value to token verification.
 *
 * @param req - The incoming HTTP request object.
 * @returns The JWT token, or undefined if the header is absent or malformed.
 */
export function extractJwt(req: Request): string | undefined {
  const authorization = req.headers.authorization;
  if (!authorization) return undefined;

  return BEARER_TOKEN_PATTERN.exec(authorization)?.[1];
}
