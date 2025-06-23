import { fetchOrgByName } from '@/helpers/query/orgs';
import { useQuery } from '@tanstack/vue-query';
import { Ref } from 'vue';

interface OrgType {
  firestoreCollection: string;
  label: string;
  singular: string;
}

interface SelectedOrg {
  id: string;
  name: string;
  tags: string[];
}

export default function useOrgNameExistsQuery(
  orgName: Ref<string>,
  orgType: Ref<OrgType | undefined>,
  selectedDistrict: Ref<SelectedOrg | undefined>,
  selectedSchool: Ref<SelectedOrg | undefined>,
) {
  return useQuery({
    enabled: false,
    queryKey: ['useOrgNameExists', orgType.value?.singular, orgName.value],
    queryFn: async () => {
      const trimmedOrgName = orgName.value.trim();

      if (trimmedOrgName === '') return true;

      const orgs = await fetchOrgByName(
        orgType.value?.firestoreCollection,
        trimmedOrgName,
        selectedDistrict.value?.name,
        selectedSchool.value?.name,
      );

      return orgs.length > 0;
    },
  });
}
