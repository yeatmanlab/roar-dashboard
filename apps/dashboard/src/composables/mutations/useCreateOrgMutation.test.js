import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import useCreateOrgMutation from './useCreateOrgMutation';
import {
  DISTRICTS_QUERY_KEY,
  DISTRICTS_LIST_QUERY_KEY,
  DISTRICT_SCHOOLS_QUERY_KEY,
  SCHOOLS_QUERY_KEY,
  SCHOOL_CLASSES_QUERY_KEY,
  CLASSES_QUERY_KEY,
  GROUPS_QUERY_KEY,
  GROUPS_LIST_QUERY_KEY,
} from '@/constants/queryKeys';

const mockDistrictCreate = vi.fn();
const mockSchoolCreate = vi.fn();
const mockClassCreate = vi.fn();
const mockGroupCreate = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    districts: { create: mockDistrictCreate },
    schools: { create: mockSchoolCreate },
    classes: { create: mockClassCreate },
    groups: { create: mockGroupCreate },
  }),
}));

// Re-export the real module as a plain (configurable) object so the invalidation
// test can `vi.spyOn(VueQuery, 'useQueryClient')` — spying directly on the ESM
// namespace throws. The composable uses the real useMutation / useQueryClient.
vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original };
});

describe('useCreateOrgMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    mockDistrictCreate.mockReset();
    mockSchoolCreate.mockReset();
    mockClassCreate.mockReset();
    mockGroupCreate.mockReset();
    mockDistrictCreate.mockResolvedValue({ status: 201, body: { data: { id: 'district-1' } } });
    mockSchoolCreate.mockResolvedValue({ status: 201, body: { data: { id: 'school-1' } } });
    mockClassCreate.mockResolvedValue({ status: 201, body: { data: { id: 'class-1' } } });
    mockGroupCreate.mockResolvedValue({ status: 201, body: { data: { id: 'group-1' } } });
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient?.clear();
  });

  it('posts districts creates to the collection root with no path param', async () => {
    const [result] = withSetup(() => useCreateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const body = { name: 'District A', abbreviation: 'DA' };
    const data = await result.mutateAsync({ orgType: 'districts', body });

    expect(mockDistrictCreate).toHaveBeenCalledWith({ body });
    expect(mockSchoolCreate).not.toHaveBeenCalled();
    expect(data).toEqual({ id: 'district-1' });
  });

  it('posts schools creates to the collection root', async () => {
    const [result] = withSetup(() => useCreateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const body = { districtId: 'district-1', name: 'School A', abbreviation: 'SA' };
    await result.mutateAsync({ orgType: 'schools', body });

    expect(mockSchoolCreate).toHaveBeenCalledWith({ body });
  });

  it('posts classes creates to the collection root', async () => {
    const [result] = withSetup(() => useCreateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const body = { schoolId: 'school-1', name: 'Class A', classType: 'homeroom' };
    await result.mutateAsync({ orgType: 'classes', body });

    expect(mockClassCreate).toHaveBeenCalledWith({ body });
  });

  it('posts groups creates to the collection root', async () => {
    const [result] = withSetup(() => useCreateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const body = { name: 'Group A', abbreviation: 'GA', groupType: 'cohort' };
    await result.mutateAsync({ orgType: 'groups', body });

    expect(mockGroupCreate).toHaveBeenCalledWith({ body });
  });

  it('throws on an unsupported org type', async () => {
    const [result] = withSetup(() => useCreateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ orgType: 'families', body: {} })).rejects.toThrow(
      /Unsupported org type for create/,
    );
  });

  it('throws a structured error on a non-201 response', async () => {
    mockDistrictCreate.mockResolvedValueOnce({ status: 403, body: { error: { code: 'forbidden' } } });

    const [result] = withSetup(() => useCreateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ orgType: 'districts', body: { name: 'x' } })).rejects.toMatchObject({
      status: 403,
      body: { error: { code: 'forbidden' } },
    });
  });

  it('invalidates every org query key on success', async () => {
    const mockInvalidateQueries = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useCreateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync({ orgType: 'districts', body: { name: 'x' } });

    const expectedKeys = [
      DISTRICTS_QUERY_KEY,
      DISTRICTS_LIST_QUERY_KEY,
      DISTRICT_SCHOOLS_QUERY_KEY,
      SCHOOLS_QUERY_KEY,
      SCHOOL_CLASSES_QUERY_KEY,
      CLASSES_QUERY_KEY,
      GROUPS_QUERY_KEY,
      GROUPS_LIST_QUERY_KEY,
    ];
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(expectedKeys.length);
    for (const key of expectedKeys) {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: [key] });
    }
  });
});
