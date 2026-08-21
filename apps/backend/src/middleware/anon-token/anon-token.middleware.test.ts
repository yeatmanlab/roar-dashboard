import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { AnonTokenMiddleware, isAnonymousToken } from './anon-token.middleware';
import { AuthService } from '../../services/auth/auth.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { DecodedUserFactory } from '../../test-support/factories/auth.factory';

vi.mock('../../services/auth/auth.service');
vi.mock('../../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function buildAnonymousDecodedUser(signInProvider = 'anonymous') {
  return DecodedUserFactory.build({
    claims: {
      firebase: { sign_in_provider: signInProvider },
    },
  });
}

function buildApp() {
  const app = express();

  app.post('/users/anonymous', AnonTokenMiddleware, (req, res) => {
    res.json({ uid: req.decodedAnonymousUser?.uid });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message, code: err.code, traceId: err.traceId });
    } else {
      res.status(500).json({ message: err.message });
    }
  });

  return app;
}

describe('isAnonymousToken', () => {
  it('returns true when sign_in_provider is "anonymous"', () => {
    expect(isAnonymousToken({ firebase: { sign_in_provider: 'anonymous' } })).toBe(true);
  });

  it('returns false when sign_in_provider is "password"', () => {
    expect(isAnonymousToken({ firebase: { sign_in_provider: 'password' } })).toBe(false);
  });

  it('returns false when sign_in_provider is "google.com"', () => {
    expect(isAnonymousToken({ firebase: { sign_in_provider: 'google.com' } })).toBe(false);
  });

  it('returns false when claims.firebase is absent', () => {
    expect(isAnonymousToken({})).toBe(false);
  });

  it('returns false when claims.firebase is null', () => {
    expect(isAnonymousToken({ firebase: null })).toBe(false);
  });

  it('returns false when claims.firebase is a non-object primitive', () => {
    expect(isAnonymousToken({ firebase: 'anonymous' })).toBe(false);
  });
});

describe('AnonTokenMiddleware', () => {
  let authServiceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    authServiceMock = vi.fn();
    AuthService.verifyToken = authServiceMock;
  });

  it('attaches decodedAnonymousUser to req and calls next() for a valid anonymous token', async () => {
    const decodedUser = buildAnonymousDecodedUser();
    authServiceMock.mockResolvedValue(decodedUser);

    const app = buildApp();
    const response = await request(app)
      .post('/users/anonymous')
      .set('Authorization', 'Bearer valid-anon-token')
      .expect(StatusCodes.OK);

    expect(authServiceMock).toHaveBeenCalledWith('valid-anon-token');
    expect(response.body.uid).toBe(decodedUser.uid);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const app = buildApp();
    const response = await request(app).post('/users/anonymous').expect(StatusCodes.UNAUTHORIZED);

    expect(authServiceMock).not.toHaveBeenCalled();
    expect(response.body.message).toBe(ApiErrorMessage.UNAUTHORIZED);
    expect(response.body.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    expect(response.body.traceId).toBeDefined();
  });

  it('returns 401 when token sign_in_provider is not "anonymous"', async () => {
    const decodedUser = buildAnonymousDecodedUser('password');
    authServiceMock.mockResolvedValue(decodedUser);

    const app = buildApp();
    const response = await request(app)
      .post('/users/anonymous')
      .set('Authorization', 'Bearer password-token')
      .expect(StatusCodes.UNAUTHORIZED);

    expect(response.body.message).toBe(ApiErrorMessage.UNAUTHORIZED);
    expect(response.body.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    expect(response.body.traceId).toBeDefined();
  });

  it('returns 401 when token sign_in_provider is "google.com"', async () => {
    const decodedUser = buildAnonymousDecodedUser('google.com');
    authServiceMock.mockResolvedValue(decodedUser);

    const app = buildApp();
    const response = await request(app)
      .post('/users/anonymous')
      .set('Authorization', 'Bearer google-token')
      .expect(StatusCodes.UNAUTHORIZED);

    expect(response.body.message).toBe(ApiErrorMessage.UNAUTHORIZED);
    expect(response.body.code).toBe(ApiErrorCode.AUTH_REQUIRED);
  });

  it('returns 401 when claims.firebase is absent from decoded token', async () => {
    const decodedUser = DecodedUserFactory.build({ claims: {} });
    authServiceMock.mockResolvedValue(decodedUser);

    const app = buildApp();
    const response = await request(app)
      .post('/users/anonymous')
      .set('Authorization', 'Bearer no-firebase-claim-token')
      .expect(StatusCodes.UNAUTHORIZED);

    expect(response.body.message).toBe(ApiErrorMessage.UNAUTHORIZED);
    expect(response.body.code).toBe(ApiErrorCode.AUTH_REQUIRED);
  });

  it('logs a warning when a non-anonymous token is presented', async () => {
    const { logger } = await import('../../logger');
    const decodedUser = buildAnonymousDecodedUser('password');
    authServiceMock.mockResolvedValue(decodedUser);

    const app = buildApp();
    await request(app).post('/users/anonymous').set('Authorization', 'Bearer password-token');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ uid: decodedUser.uid, signInProvider: 'password' }),
      'Non-anonymous token presented to anonymous-only endpoint — likely a client misconfiguration',
    );
  });

  it('calls next(ApiError) when AuthService.verifyToken throws an ApiError (expired token)', async () => {
    const expiredError = new ApiError(ApiErrorMessage.UNAUTHORIZED, {
      statusCode: StatusCodes.UNAUTHORIZED,
      code: ApiErrorCode.AUTH_TOKEN_EXPIRED,
    });
    authServiceMock.mockRejectedValue(expiredError);

    const app = buildApp();
    const response = await request(app)
      .post('/users/anonymous')
      .set('Authorization', 'Bearer expired-token')
      .expect(StatusCodes.UNAUTHORIZED);

    expect(response.body.code).toBe(ApiErrorCode.AUTH_TOKEN_EXPIRED);
    expect(response.body.traceId).toBeDefined();
  });

  it('wraps unexpected AuthService errors in a 500 ApiError and calls next', async () => {
    authServiceMock.mockRejectedValue(new Error('Firebase SDK exploded'));

    const app = buildApp();
    const response = await request(app)
      .post('/users/anonymous')
      .set('Authorization', 'Bearer bad-token')
      .expect(StatusCodes.INTERNAL_SERVER_ERROR);

    expect(response.body.message).toBe(ApiErrorMessage.INTERNAL_SERVER_ERROR);
    expect(response.body.code).toBe(ApiErrorCode.INTERNAL);
    expect(response.body.traceId).toBeDefined();
  });
});
