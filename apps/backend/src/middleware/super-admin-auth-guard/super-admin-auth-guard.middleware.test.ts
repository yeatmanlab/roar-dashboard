import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { SuperAdminAuthGuardMiddleware } from './super-admin-auth-guard.middleware';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';

vi.mock('../../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe('SuperAdminAuthGuardMiddleware', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();

    // Add error handler to format ApiError responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof ApiError) {
        res.status(err.statusCode).json({
          message: err.message,
          code: err.code,
          traceId: err.traceId,
        });
      } else {
        res.status(err.status || err.statusCode || 500).json({
          message: err.message,
          code: err.code,
        });
      }
    });
  });

  /**
   * Builds a test Express app with an optional req.user injected before the middleware.
   */
  function buildApp(user?: { userId: string; isSuperAdmin: boolean }) {
    const testApp = express();

    // Simulate AuthGuardMiddleware setting req.user
    if (user) {
      testApp.use((req, _res, next) => {
        req.user = user;
        next();
      });
    }

    testApp.use(SuperAdminAuthGuardMiddleware);

    testApp.get('/', (req, res) => {
      res.json({ user: req.user });
    });

    // Error handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    testApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof ApiError) {
        res.status(err.statusCode).json({
          message: err.message,
          code: err.code,
          traceId: err.traceId,
        });
      } else {
        res.status(err.status || err.statusCode || 500).json({
          message: err.message,
          code: err.code,
        });
      }
    });

    return testApp;
  }

  it('passes through when user is a super admin', async () => {
    const testApp = buildApp({ userId: 'user-123', isSuperAdmin: true });

    const response = await request(testApp).get('/').expect(StatusCodes.OK);

    expect(response.body.user).toEqual({ userId: 'user-123', isSuperAdmin: true });
  });

  it('returns 403 when user is not a super admin', async () => {
    const testApp = buildApp({ userId: 'user-456', isSuperAdmin: false });

    const response = await request(testApp).get('/').expect(StatusCodes.FORBIDDEN);

    expect(response.body.message).toBe(ApiErrorMessage.FORBIDDEN);
    expect(response.body.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    expect(response.body.traceId).toBeDefined();
  });

  it('returns 401 when req.user is missing', async () => {
    const testApp = buildApp(); // No user injected

    const response = await request(testApp).get('/').expect(StatusCodes.UNAUTHORIZED);

    expect(response.body.message).toBe('Authentication required.');
    expect(response.body.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    expect(response.body.traceId).toBeDefined();
  });
});
