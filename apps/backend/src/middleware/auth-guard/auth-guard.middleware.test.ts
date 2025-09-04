import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { AuthGuardMiddleware } from './auth-guard.middleware';
import { AuthService } from '../../services/auth/auth.service';
import { API_ERROR_CODES } from '../../constants/api-error-codes';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';
import { DecodedUserFactory } from '../../test-support/factories/auth.factory';

// Mock AuthService
vi.mock('../../services/auth/auth.service');

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

    // Add error handler middleware to properly format http-errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(err.status || err.statusCode || 500).json({
        message: err.message,
        code: err.code,
        status: err.status || err.statusCode || 500,
      });
    });
  });

  it('should successfully authenticate valid token and attach user to request', async () => {
    const mockUser = DecodedUserFactory.build();

    authServiceMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockUser), 10)));

    const response = await request(app)
      .get('/')
      .set('Authorization', 'Bearer mock-valid-jwt-token')
      .expect(StatusCodes.OK);

    expect(authServiceMock).toHaveBeenCalledWith('mock-valid-jwt-token');
    expect(response.body.user).toEqual(mockUser);
  });

  describe('error handling', () => {
    describe('missing JWT', () => {
      it('should return 401 when no authorization header is provided', async () => {
        const response = await request(app).get('/').expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Token missing.');
        expect(response.body.code).toBe(API_ERROR_CODES.AUTH.REQUIRED);
        expect(authServiceMock).not.toHaveBeenCalled();
      });

      it('should return 401 when authorization header is malformed', async () => {
        const response = await request(app)
          .get('/')
          .set('Authorization', 'InvalidFormat')
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Token missing.');
        expect(response.body.code).toBe(API_ERROR_CODES.AUTH.REQUIRED);
        expect(authServiceMock).not.toHaveBeenCalled();
      });

      it('should return 401 when Bearer token is empty', async () => {
        const response = await request(app).get('/').set('Authorization', 'Bearer ').expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Token missing.');
        expect(response.body.code).toBe(API_ERROR_CODES.AUTH.REQUIRED);
        expect(authServiceMock).not.toHaveBeenCalled();
      });
    });

    describe('invalid JWT', () => {
      it('should handle expired token error specifically', async () => {
        const mockError = { code: FIREBASE_ERROR_CODES.AUTH.ID_TOKEN_EXPIRED };
        authServiceMock.mockRejectedValue(mockError);

        const response = await request(app)
          .get('/')
          .set('Authorization', 'Bearer expired-token')
          .expect(StatusCodes.UNAUTHORIZED);

        expect(response.body.message).toBe('Token expired.');
        expect(response.body.code).toBe(API_ERROR_CODES.AUTH.TOKEN_EXPIRED);
        expect(authServiceMock).toHaveBeenCalledWith('expired-token');
      });
    });

    it("should handle Firebase's invalid token error", async () => {
      const mockError = { code: 'auth/invalid-token' };
      authServiceMock.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer invalid-token')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.message).toBe('Invalid token.');
      expect(response.body.code).toBe(API_ERROR_CODES.AUTH.TOKEN_INVALID);
    });

    it('should handle unexpected errors as invalid token', async () => {
      const mockError = new Error('Network error');
      authServiceMock.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer malformed-token')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.message).toBe('Invalid token.');
      expect(response.body.code).toBe(API_ERROR_CODES.AUTH.TOKEN_INVALID);
    });

    it('should handle auth service exceptions', async () => {
      const mockError = 'String error';
      authServiceMock.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/')
        .set('Authorization', 'Bearer failing-token')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.message).toBe('Invalid token.');
      expect(response.body.code).toBe(API_ERROR_CODES.AUTH.TOKEN_INVALID);
    });
  });
});
