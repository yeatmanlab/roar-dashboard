import { ref } from 'vue';
import { describe, it, expect, vi } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { type QueryClient } from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import useOrgQuery from './useOrgQuery';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';

vi.mock('@/composables/queries/useDistrictsQuery', () => ({
  default: vi.fn(() => 'useDistrictsQuery'),
}));
vi.mock('@/composables/queries/useSchoolsQuery', () => ({
  default: vi.fn(() => 'useSchoolsQuery'),
}));
vi.mock('@/composables/queries/useClassesQuery', () => ({
  default: vi.fn(() => 'useClassesQuery'),
}));
vi.mock('@/composables/queries/useGroupsQuery', () => ({
  default: vi.fn(() => 'useGroupsQuery'),
}));
vi.mock('@/composables/queries/useFamiliesQuery', () => ({
  default: vi.fn(() => 'useFamiliesQuery'),
}));

describe('useOrgQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should return useDistrictsQuery for districts as org type', () => {
    const mockOrgType = SINGULAR_ORG_TYPES.DISTRICTS;
    const mockOrgIds = ref([nanoid(), nanoid()]);
    const result = useOrgQuery(mockOrgType, mockOrgIds);
    expect(result).toBe('useDistrictsQuery');
  });

  it('should return useSchoolsQuery for schools as org type', () => {
    const mockOrgType = SINGULAR_ORG_TYPES.SCHOOLS;
    const mockOrgIds = ref([nanoid(), nanoid()]);
    const result = useOrgQuery(mockOrgType, mockOrgIds);
    expect(result).toBe('useSchoolsQuery');
  });

  it('should return useClassesQuery for classes as org type', () => {
    const mockOrgType = SINGULAR_ORG_TYPES.CLASSES;
    const mockOrgIds = ref([nanoid(), nanoid()]);
    const result = useOrgQuery(mockOrgType, mockOrgIds);
    expect(result).toBe('useClassesQuery');
  });

  it('should return useGroupsQuery for groups as org type', () => {
    const mockOrgType = SINGULAR_ORG_TYPES.GROUPS;
    const mockOrgIds = ref([nanoid(), nanoid()]);
    const result = useOrgQuery(mockOrgType, mockOrgIds);
    expect(result).toBe('useGroupsQuery');
  });

  it('should return useFamiliesQuery for families as org type', () => {
    const mockOrgType = SINGULAR_ORG_TYPES.FAMILIES;
    const mockOrgIds = ref([nanoid(), nanoid()]);
    const result = useOrgQuery(mockOrgType, mockOrgIds);
    expect(result).toBe('useFamiliesQuery');
  });

  it('should throw an error for unsupported org type', () => {
    const mockOrgType = 'UNSUPPORTED';
    const mockOrgIds = ref([nanoid(), nanoid()]);
    expect(() => useOrgQuery(mockOrgType, mockOrgIds)).toThrow('Unsupported org type: UNSUPPORTED');
  });
});
