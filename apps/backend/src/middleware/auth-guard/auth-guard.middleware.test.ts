import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { AuthGuardMiddleware } from './auth-guard.middleware';
import { AuthService } from '../../services/auth/auth.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { DecodedUserFactory } from '../../test-support/factories/auth.factory';
import { UserFactory } from '../../test-support/factories/user.factory';

// Mock AuthService
vi.mock('../../services/auth/auth.service');

// Hoist the mock function so it's available when vi.mock runs
const mockFindByAuthId = vi.hoisted(() => vi.fn());

// Mock UserService
vi.mock('../../services/user', () => ({
  UserService: () => ({
    findByAuthId: mockFindByAuthId,
  }),
}));

// Mock UserRepository
vi.mock('../../repositories', () => ({
  UserRepository: vi.fn(),
}));

// Mock CoreDbClient
vi.mock('../../db/clients', () => ({
  CoreDbClient: {},
}));

describe('AuthGuardMiddleware', () => {
  let app: express.Application;
  let authServiceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup AuthService mock
    authServiceMock = vi.fn();
    AuthService.verifyToken = authServiceMock;

    // Create Express app for testing
    app = express();
    app.use(AuthGuardMiddleware);
    app.get('/', (req, res) => {
      res.json({ user: req.user });
    });

    // Add error handler middleware to properly format ApiError
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

  it('should successfully authenticate valid token and attach AuthContext to request', async () => {
    const mockDecodedUser = DecodedUserFactory.build();
    const mockUser = UserFactory.build({ authId: mockDecodedUser.uid });

    authServiceMock.mockResolvedValue(mockDecodedUser);
    mockFindByAuthId.mockResolvedValue(mockUser);

    const response = await request(app)
      .get('/')
      .set('Authorization', 'Bearer mock-valid-jwt-token')
      .expect(StatusCodes.OK);

    expect(authServiceMock).toHaveBeenCalledWith('mock-valid-jwt-token');
    expect(mockFindByAuthId).toHaveBeenCalledWith(mockDecodedUser.uid);
    expect(response.body.user).toEqual({
      userId: mockUser.id,
      isSuperAdmin: mockUser.isSuperAdmin ?? false,
    });
  });

  it('should return 401 when user is not found in database', async () => {
    const mockDecodedUser = DecodedUserFactory.build();

    authServiceMock.mockResolvedValue(mockDecodedUser);
    mockFindByAuthId.mockResolvedValue(null);

    const response = await request(app)
      .get('/')
      .set('Authorization', 'Bearer mock-valid-jwt-token')
      .expect(StatusCodes.UNAUTHORIZED);

    expect(authServiceMock).toHaveBeenCalledWith('mock-valid-jwt-token');
    expect(mockFindByAuthId).toHaveBeenCalledWith(mockDecodedUser.uid);
    expect(response.body.message).toBe('User not found.');
    expect(response.body.code).toBe(ApiErrorCode.AUTH_USER_NOT_FOUND);
    expect(response.body.traceId).toBeDefined();
  });

  describe('rostering ended', () => {
    it('should return 403 when user rosteringEnded is in the past', async () => {
      const mockDecodedUser = DecodedUserFactory.build();
      const pastDate = new Date('2024-01-01T00:00:00Z');
      const mockUser = UserFactory.build({
        authId: mockDecodedUser.uid,
        rosteringEnded: pastDate,
      });

      authServiceMock.mockResolvedValue(mockDecodedUser);
      mockFindByAuthId.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer mock-valid-jwt-token')
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.message).toBe(ApiErrorMessage.FORBIDDEN);
      expect(response.body.code).toBe(ApiErrorCode.AUTH_ROSTERING_ENDED);
      expect(response.body.traceId).toBeDefined();
    });

    it('should return 403 when user rosteringEnded is at or before the current time (boundary case)', async () => {
      const mockDecodedUser = DecodedUserFactory.build();
      const justBeforeNow = new Date(Date.now() - 1000); // 1 second ago to avoid race
      const mockUser = UserFactory.build({
        authId: mockDecodedUser.uid,
        rosteringEnded: justBeforeNow,
      });

      authServiceMock.mockResolvedValue(mockDecodedUser);
      mockFindByAuthId.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer mock-valid-jwt-token')
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.code).toBe(ApiErrorCode.AUTH_ROSTERING_ENDED);
    });

    it('should allow access when user rosteringEnded is in the future', async () => {
      const mockDecodedUser = DecodedUserFactory.build();
      const futureDate = new Date(Date.now() + 86400000); // 24 hours from now
      const mockUser = UserFactory.build({
        authId: mockDecodedUser.uid,
        rosteringEnded: futureDate,
      });

      authServiceMock.mockResolvedValue(mockDecodedUser);
      mockFindByAuthId.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer mock-valid-jwt-token')
        .expect(StatusCodes.OK);

      expect(response.body.user).toEqual({
        userId: mockUser.id,
        isSuperAdmin: mockUser.isSuperAdmin ?? false,
      });
    });

    it('should allow access when user rosteringEnded is null', async () => {
      const mockDecodedUser = DecodedUserFactory.build();
      const mockUser = UserFactory.build({
        authId: mockDecodedUser.uid,
        rosteringEnded: null,
      });

      authServiceMock.mockResolvedValue(mockDecodedUser);
      mockFindByAuthId.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer mock-valid-jwt-token')
        .expect(StatusCodes.OK);

      expect(response.body.user).toEqual({
        userId: mockUser.id,
        isSuperAdmin: mockUser.isSuperAdmin ?? false,
      });
    });

    it('should return 403 when super admin has rosteringEnded in the past', async () => {
      const mockDecodedUser = DecodedUserFactory.build();
      const pastDate = new Date('2024-01-01T00:00:00Z');
      const mockUser = UserFactory.build({
        authId: mockDecodedUser.uid,
        rosteringEnded: pastDate,
        isSuperAdmin: true,
      });

      authServiceMock.mockResolvedValue(mockDecodedUser);
      mockFindByAuthId.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer mock-valid-jwt-token')
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body.code).toBe(ApiErrorCode.AUTH_ROSTERING_ENDED);
      expect(response.body.message).toBe(ApiErrorMessage.FORBIDDEN);
    });
  });

  describe('error handling', () => {
    describe('missing JWT', () => {
      it('should return 401 when no authorization header is provided', async () => {
        const response = await request(app).get('/').expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Token missing.');
        expect(response.body.code).toBe(ApiErrorCode.AUTH_REQUIRED);
        expect(response.body.traceId).toBeDefined();
        expect(authServiceMock).not.toHaveBeenCalled();
      });

      it('should return 401 when authorization header is malformed', async () => {
        const response = await request(app)
          .get('/')
          .set('Authorization', 'InvalidFormat')
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Token missing.');
        expect(response.body.code).toBe(ApiErrorCode.AUTH_REQUIRED);
        expect(authServiceMock).not.toHaveBeenCalled();
      });

      it('should return 401 when Bearer token is empty', async () => {
        const response = await request(app).get('/').set('Authorization', 'Bearer ').expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Token missing.');
        expect(response.body.code).toBe(ApiErrorCode.AUTH_REQUIRED);
        expect(authServiceMock).not.toHaveBeenCalled();
      });
    });

    describe('invalid JWT', () => {
      it('should pass through ApiError from AuthService for expired token', async () => {
        const expiredError = new ApiError('Token expired.', {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_TOKEN_EXPIRED,
        });
        authServiceMock.mockRejectedValue(expiredError);

        const response = await request(app)
          .get('/')
          .set('Authorization', 'Bearer expired-token')
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Token expired.');
        expect(response.body.code).toBe(ApiErrorCode.AUTH_TOKEN_EXPIRED);
        expect(response.body.traceId).toBeDefined();
        expect(authServiceMock).toHaveBeenCalledWith('expired-token');
      });

      it('should pass through ApiError from AuthService for invalid token', async () => {
        const invalidError = new ApiError('Invalid token.', {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_TOKEN_INVALID,
        });
        authServiceMock.mockRejectedValue(invalidError);

        const response = await request(app)
          .get('/')
          .set('Authorization', 'Bearer invalid-token')
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Invalid token.');
        expect(response.body.code).toBe(ApiErrorCode.AUTH_TOKEN_INVALID);
        expect(response.body.traceId).toBeDefined();
      });
    });

    it('should wrap unexpected non-ApiError as internal error', async () => {
      const unexpectedError = new Error('Unexpected failure');
      authServiceMock.mockRejectedValue(unexpectedError);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer failing-token')
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      expect(response.body.message).toBe('Authentication failed.');
      expect(response.body.code).toBe(ApiErrorCode.INTERNAL);
      expect(response.body.traceId).toBeDefined();
    });
  });
});
