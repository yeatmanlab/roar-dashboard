import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';

/**
 * Middleware that restricts access to super admins only.
 *
 * Must be placed after `AuthGuardMiddleware` in the middleware chain so that
 * `req.user` is already populated. If `req.user` is missing (misconfiguration),
 * returns 401. If the user is not a super admin, returns 403.
 *
 * @param req - The Express request object (expects `req.user` from AuthGuardMiddleware)
 * @param _res - The Express response object (unused)
 * @param next - The Express next function
 */
export function SuperAdminAuthGuardMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(
      new ApiError('Authentication required.', {
        statusCode: StatusCodes.UNAUTHORIZED,
        code: ApiErrorCode.AUTH_REQUIRED,
      }),
    );
  }

  if (!req.user.isSuperAdmin) {
    logger.warn({ userId: req.user.userId }, 'Non-super-admin attempted access to super-admin-only route');
    return next(
      new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId: req.user.userId },
      }),
    );
  }

  return next();
}
