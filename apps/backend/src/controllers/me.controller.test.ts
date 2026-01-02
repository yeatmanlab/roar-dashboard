import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { MeController } from './me.controller';
import { UserFactory } from '../test-support/factories/user.factory';

// Hoist mock function
const mockGetById = vi.hoisted(() => vi.fn());

// Mock UserService
vi.mock('../services/user', () => ({
  UserService: () => ({
    getById: mockGetById,
  }),
}));

describe('MeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return user profile when user exists', async () => {
      const mockUser = UserFactory.build({
        nameFirst: 'John',
        nameLast: 'Doe',
        userType: 'student',
      });
      mockGetById.mockResolvedValue(mockUser);

      const result = await MeController.get(mockUser.id);

      expect(mockGetById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        status: StatusCodes.OK,
        body: {
          data: {
            id: mockUser.id,
            userType: mockUser.userType,
            nameFirst: mockUser.nameFirst,
            nameLast: mockUser.nameLast,
          },
        },
      });
    });

    it('should return 401 when user not found', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await MeController.get('non-existent-id');

      expect(mockGetById).toHaveBeenCalledWith('non-existent-id');
      expect(result).toEqual({
        status: StatusCodes.UNAUTHORIZED,
        body: { error: { message: 'User not found' } },
      });
    });

    it('should handle null name fields', async () => {
      const mockUser = UserFactory.build({
        nameFirst: null,
        nameLast: null,
      });
      mockGetById.mockResolvedValue(mockUser);

      const result = await MeController.get(mockUser.id);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({
        data: {
          id: mockUser.id,
          userType: mockUser.userType,
          nameFirst: null,
          nameLast: null,
        },
      });
    });
  });
});
