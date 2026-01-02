import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { UsersController } from './users.controller';
import { UserFactory } from '../test-support/factories/user.factory';

// Hoist mock function
const mockGetById = vi.hoisted(() => vi.fn());

// Mock UserService
vi.mock('../services/user', () => ({
  UserService: () => ({
    getById: mockGetById,
  }),
}));

describe('UsersController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should return user data when user exists', async () => {
      const mockUser = UserFactory.build({
        email: 'test@example.com',
        username: 'testuser',
      });
      mockGetById.mockResolvedValue(mockUser);

      const result = await UsersController.getById(mockUser.id);

      expect(mockGetById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        status: StatusCodes.OK,
        body: {
          data: {
            id: mockUser.id,
            auth_id: mockUser.authId,
            email: mockUser.email,
            username: mockUser.username,
          },
        },
      });
    });

    it('should return 404 when user not found', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await UsersController.getById('non-existent-id');

      expect(mockGetById).toHaveBeenCalledWith('non-existent-id');
      expect(result).toEqual({
        status: StatusCodes.NOT_FOUND,
        body: { error: { message: 'User not found' } },
      });
    });

    it('should return 404 when user has no authId', async () => {
      const mockUser = UserFactory.build({ authId: null });
      mockGetById.mockResolvedValue(mockUser);

      const result = await UsersController.getById(mockUser.id);

      expect(result).toEqual({
        status: StatusCodes.NOT_FOUND,
        body: { error: { message: 'User not found' } },
      });
    });

    it('should omit null email field', async () => {
      const mockUser = UserFactory.build({
        email: null,
        username: 'testuser',
      });
      mockGetById.mockResolvedValue(mockUser);

      const result = await UsersController.getById(mockUser.id);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({
        data: {
          id: mockUser.id,
          auth_id: mockUser.authId,
          username: mockUser.username,
        },
      });
      expect(result.body.data).not.toHaveProperty('email');
    });

    it('should omit null username field', async () => {
      const mockUser = UserFactory.build({
        email: 'test@example.com',
        username: null,
      });
      mockGetById.mockResolvedValue(mockUser);

      const result = await UsersController.getById(mockUser.id);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({
        data: {
          id: mockUser.id,
          auth_id: mockUser.authId,
          email: mockUser.email,
        },
      });
      expect(result.body.data).not.toHaveProperty('username');
    });

    it('should omit both email and username when null', async () => {
      const mockUser = UserFactory.build({
        email: null,
        username: null,
      });
      mockGetById.mockResolvedValue(mockUser);

      const result = await UsersController.getById(mockUser.id);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({
        data: {
          id: mockUser.id,
          auth_id: mockUser.authId,
        },
      });
    });
  });
});
