import { USE_ASSIGNMENT_EXISTS_QUERY_KEY } from '@/constants/queryKeys';
import { normalizeToLowercase } from '@/helpers';
import { fetchAssignmentsByNameAndDistricts } from '@/helpers/query/assignments';
import { useQuery } from '@tanstack/vue-query';
import { Ref } from 'vue';

export default function useAssignmentByNameQuery(name: Ref<string>, districs: Ref<string[]>) {
  return useQuery({
    enabled: false,
    queryKey: [USE_ASSIGNMENT_EXISTS_QUERY_KEY, name.value, districs.value],
    queryFn: async () => {
      const normalizedName = normalizeToLowercase(name.value);

      if (!normalizedName) return null;

      const assignments = await fetchAssignmentsByNameAndDistricts(name.value, normalizedName, districs.value);

      return Array.isArray(assignments) ? assignments.length > 0 : null;
    },
  });
}
