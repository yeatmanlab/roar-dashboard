import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { AuthService } from '../../services/auth/auth.service';
import { extractJwt } from './jwt-extractor';

// Ready-to-use AuthService singleton is imported directly

/**
 * The AuthGuardMiddleware extracts the JWT token from the Authorization header, validates it and uses the AuthService
 * to decode the user information before passing the request to the next middleware.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next function. If successful, the user information is attached to the request.
 *
 * @returns The next function.
 * @throws {HttpError} If the token is missing or invalid.
 */

export async function AuthGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractJwt(req);
    if (!token) return next(createError(StatusCodes.UNAUTHORIZED, 'Missing bearer token'));

    req.user = await AuthService.verifyToken(token);
    return next();
  } catch {
    return next(createError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token'));
  }
}
