import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import useUpdateOrgMutation from './useUpdateOrgMutation';
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

const mockDistrictUpdate = vi.fn();
const mockSchoolUpdate = vi.fn();
const mockClassUpdate = vi.fn();
const mockGroupUpdate = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    districts: { update: mockDistrictUpdate },
    schools: { update: mockSchoolUpdate },
    classes: { update: mockClassUpdate },
    groups: { update: mockGroupUpdate },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useUpdateOrgMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    mockDistrictUpdate.mockReset();
    mockSchoolUpdate.mockReset();
    mockClassUpdate.mockReset();
    mockGroupUpdate.mockReset();
    mockDistrictUpdate.mockResolvedValue({ status: 200, body: { data: { id: 'district-1' } } });
    mockSchoolUpdate.mockResolvedValue({ status: 200, body: { data: { id: 'school-1' } } });
    mockClassUpdate.mockResolvedValue({ status: 200, body: { data: { id: 'class-1' } } });
    mockGroupUpdate.mockResolvedValue({ status: 200, body: { data: { id: 'group-1' } } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    queryClient?.clear();
  });

  it('dispatches districts updates with the `id` path param', async () => {
    const [result] = withSetup(() => useUpdateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const body = { name: 'District A', abbreviation: 'DA' };
    const data = await result.mutateAsync({ orgType: 'districts', orgId: 'district-1', body });

    expect(mockDistrictUpdate).toHaveBeenCalledWith({ params: { id: 'district-1' }, body });
    expect(mockSchoolUpdate).not.toHaveBeenCalled();
    expect(data).toEqual({ id: 'district-1' });
  });

  it('dispatches schools updates with the `schoolId` path param', async () => {
    const [result] = withSetup(() => useUpdateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const body = { name: 'School A' };
    await result.mutateAsync({ orgType: 'schools', orgId: 'school-1', body });

    expect(mockSchoolUpdate).toHaveBeenCalledWith({ params: { schoolId: 'school-1' }, body });
  });

  it('dispatches classes updates with the `classId` path param', async () => {
    const [result] = withSetup(() => useUpdateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const body = { name: 'Class A' };
    await result.mutateAsync({ orgType: 'classes', orgId: 'class-1', body });

    expect(mockClassUpdate).toHaveBeenCalledWith({ params: { classId: 'class-1' }, body });
  });

  it('dispatches groups updates with the `groupId` path param', async () => {
    const [result] = withSetup(() => useUpdateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const body = { name: 'Group A' };
    await result.mutateAsync({ orgType: 'groups', orgId: 'group-1', body });

    expect(mockGroupUpdate).toHaveBeenCalledWith({ params: { groupId: 'group-1' }, body });
  });

  it('throws on an unsupported org type', async () => {
    const [result] = withSetup(() => useUpdateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ orgType: 'families', orgId: 'x', body: {} })).rejects.toThrow(
      /Unsupported org type for update/,
    );
  });

  it('throws a structured error on a non-200 response', async () => {
    mockDistrictUpdate.mockResolvedValueOnce({ status: 400, body: { error: { code: 'validation' } } });

    const [result] = withSetup(() => useUpdateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(
      result.mutateAsync({ orgType: 'districts', orgId: 'district-1', body: { name: 'x' } }),
    ).rejects.toMatchObject({
      status: 400,
      body: { error: { code: 'validation' } },
    });
  });

  it('invalidates every org query key on success', async () => {
    const mockInvalidateQueries = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useUpdateOrgMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync({ orgType: 'districts', orgId: 'district-1', body: { name: 'x' } });

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
