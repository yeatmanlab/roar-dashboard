import { USE_ASSIGNMENT_EXISTS_QUERY_KEY } from '@/constants/queryKeys';
import { normalizeToLowercase } from '@/helpers';
import { fetchAssignmentsByNameAndSite } from '@/helpers/query/assignments';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { Ref } from 'vue';

export default function useAssignmentExistsQuery(name: Ref<string>, adminId: string | null) {
  const authStore = useAuthStore();
  const { currentSite } = storeToRefs(authStore);

  return useQuery({
    enabled: false,
    queryKey: [USE_ASSIGNMENT_EXISTS_QUERY_KEY, currentSite.value, name.value],
    queryFn: async () => {
      const normalizedName = normalizeToLowercase(name.value);

      if (!normalizedName || !currentSite.value) return false;

      const assignments = await fetchAssignmentsByNameAndSite(name.value, normalizedName, currentSite.value, adminId);

      return Array.isArray(assignments) ? assignments?.length > 0 : false;
    },
  });
}
