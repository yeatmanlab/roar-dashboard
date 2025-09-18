import type { Request } from 'express';

/**
 * Extracts the JWT token from the Authorization header
 *
 * @param req - The incoming HTTP request object.
 * @returns The JWT token or undefined if not found.
 */
export function extractJwt(req: Request): string | undefined {
  return req.headers.authorization?.split(' ')[1];
}
