import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { registerMeRoutes } from './me';
import { AuthService } from '../services/auth/auth.service';
import { DecodedUserFactory } from '../test-support/factories/auth.factory';
import { UserFactory } from '../test-support/factories/user.factory';

// Mock AuthService
vi.mock('../services/auth/auth.service');

// Hoist mock functions
const mockFindByAuthId = vi.hoisted(() => vi.fn());
const mockGetById = vi.hoisted(() => vi.fn());

// Mock UserService
vi.mock('../services/user', () => ({
  UserService: () => ({
    findByAuthId: mockFindByAuthId,
    getById: mockGetById,
  }),
}));

// Mock getCoreDbClient
vi.mock('../db/clients', () => ({
  getCoreDbClient: () => ({}),
}));

describe('GET /me', () => {
  let app: express.Application;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authServiceMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    authServiceMock = vi.fn();
    AuthService.verifyToken = authServiceMock;

    app = express();
    app.use(express.json());

    const router = express.Router();
    registerMeRoutes(router);
    app.use(router);

    // Error handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(err.status || err.statusCode || 500).json({
        error: {
          message: err.message,
          code: err.code,
        },
      });
    });
  });

  it('should return the authenticated user profile', async () => {
    const mockDecodedUser = DecodedUserFactory.build();
    const mockUser = UserFactory.build({
      authId: mockDecodedUser.uid,
      nameFirst: 'John',
      nameLast: 'Doe',
    });

    authServiceMock.mockResolvedValue(mockDecodedUser);
    mockFindByAuthId.mockResolvedValue(mockUser);
    mockGetById.mockResolvedValue(mockUser);

    const response = await request(app).get('/me').set('Authorization', 'Bearer valid-token').expect(StatusCodes.OK);

    expect(response.body).toEqual({
      data: {
        id: mockUser.id,
        userType: mockUser.userType,
        nameFirst: mockUser.nameFirst,
        nameLast: mockUser.nameLast,
      },
    });
  });

  it('should return 401 when no token is provided', async () => {
    const response = await request(app).get('/me').expect(StatusCodes.UNAUTHORIZED);

    expect(response.body.error.message).toBe('Token missing.');
  });

  it('should return 401 when user is not found in database', async () => {
    const mockDecodedUser = DecodedUserFactory.build();

    authServiceMock.mockResolvedValue(mockDecodedUser);
    mockFindByAuthId.mockResolvedValue(null);

    const response = await request(app)
      .get('/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(StatusCodes.UNAUTHORIZED);

    expect(response.body.error.message).toBe('User not found.');
  });

  it('should handle null name fields', async () => {
    const mockDecodedUser = DecodedUserFactory.build();
    const mockUser = UserFactory.build({
      authId: mockDecodedUser.uid,
      nameFirst: null,
      nameLast: null,
    });

    authServiceMock.mockResolvedValue(mockDecodedUser);
    mockFindByAuthId.mockResolvedValue(mockUser);
    mockGetById.mockResolvedValue(mockUser);

    const response = await request(app).get('/me').set('Authorization', 'Bearer valid-token').expect(StatusCodes.OK);

    expect(response.body.data.nameFirst).toBeNull();
    expect(response.body.data.nameLast).toBeNull();
  });
});
