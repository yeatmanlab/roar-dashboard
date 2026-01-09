import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user.service';
import { UserFactory } from '../../test-support/factories/user.factory';

describe('UserService', () => {
  const mockUserRepository = {
    findByAuthId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findByAuthId', () => {
    it('should return user when found', async () => {
      const mockUser = UserFactory.build();
      mockUserRepository.findByAuthId.mockResolvedValue(mockUser);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });
      const result = await userService.findByAuthId('test-auth-id');

      expect(mockUserRepository.findByAuthId).toHaveBeenCalledWith('test-auth-id');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findByAuthId.mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });
      const result = await userService.findByAuthId('non-existent-auth-id');

      expect(mockUserRepository.findByAuthId).toHaveBeenCalledWith('non-existent-auth-id');
      expect(result).toBeNull();
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Database error');
      mockUserRepository.findByAuthId.mockRejectedValue(error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });

      await expect(userService.findByAuthId('test-auth-id')).rejects.toThrow('Database error');
    });
  });
});
