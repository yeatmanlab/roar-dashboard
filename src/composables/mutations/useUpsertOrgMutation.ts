import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { CreateOrgType } from '@levante-framework/levante-zod';
import { ORG_MUTATION_KEY, SITE_OVERVIEW_QUERY_KEY } from '@/constants/queryKeys';
import { groupsRepository } from '@/firebase/repositories/GroupsRepository';

const useUpsertOrgMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CreateOrgType>({
    mutationKey: [ORG_MUTATION_KEY],
    mutationFn: async (data: CreateOrgType): Promise<void> => {
      await groupsRepository.upsertOrg(data);
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: [SITE_OVERVIEW_QUERY_KEY, data.siteId] });
    },
    onError: (err, newOrgData) => {
      console.error('Error upserting org:', err, newOrgData);
    },
  });
};

export default useUpsertOrgMutation;
