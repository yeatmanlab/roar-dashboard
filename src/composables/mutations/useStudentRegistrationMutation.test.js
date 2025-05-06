import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMutation } from '@tanstack/vue-query';
import useStudentRegistrationMutation from './useStudentRegistrationMutation';

vi.mock('@tanstack/vue-query', () => ({
  useMutation: vi.fn(),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    roarfirekit: {
      createUpdateUsers: vi.fn(),
    },
  }),
}));

describe('useStudentRegistrationMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMutation.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
      isError: false,
      isSuccess: false,
    });
  });

  it('should call useMutation with the correct parameters', () => {
    useStudentRegistrationMutation();

    expect(useMutation).toHaveBeenCalledTimes(1);
    expect(useMutation).toHaveBeenCalledWith(expect.objectContaining({
      mutationFn: expect.any(Function),
    }));
  });

  it('should chunk users and call createUpdateUsers for each chunk', async () => {
    let capturedMutationFn;
    useMutation.mockImplementation(({ mutationFn }) => {
      capturedMutationFn = mutationFn;
      return {
        mutate: vi.fn(),
        isLoading: false,
        isError: false,
        isSuccess: false,
      };
    });

    const mockCreateUpdateUsers = vi.fn().mockResolvedValue({
      data: [{ id: 'user1', status: 'fulfilled' }],
    });

    vi.mock('@/store/auth', () => ({
      useAuthStore: () => ({
        roarfirekit: {
          createUpdateUsers: mockCreateUpdateUsers,
        },
      }),
    }));

    useStudentRegistrationMutation();

    const users = Array.from({ length: 60 }, (_, i) => ({ id: `user${i}` }));

    await capturedMutationFn(users);

    expect(mockCreateUpdateUsers).toHaveBeenCalledTimes(2);
  });
});
