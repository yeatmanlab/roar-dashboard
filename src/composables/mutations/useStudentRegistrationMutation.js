import { useMutation } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import _chunk from 'lodash/chunk';

/**
 * Student Registration mutation.
 *
 * TanStack mutation to register students and handle success/error states.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useStudentRegistrationMutation = () => {
  const authStore = useAuthStore();

  return useMutation({
    mutationFn: async (students) => {
      const results = [];
      const chunkedUsers = _chunk(students, 50);
      
      for (const chunk of chunkedUsers) {
        const chunkResults = await authStore.roarfirekit.createUpdateUsers(chunk);
        results.push(...chunkResults.data);
      }
      
      return results;
    },
  });
};

export default useStudentRegistrationMutation;
