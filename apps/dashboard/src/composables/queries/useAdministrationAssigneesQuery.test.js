import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATION_ASSIGNEES_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationAssigneesQuery from './useAdministrationAssigneesQuery';

const mockGetAssignees = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ administrations: { getAssignees: mockGetAssignees } }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original, useQuery: vi.fn().mockImplementation(original.useQuery) };
});

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

describe('useAdministrationAssigneesQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetAssignees.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the assignees query key', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAdministrationAssigneesQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ADMINISTRATION_ASSIGNEES_QUERY_KEY, expect.anything()],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('fetches assignees and returns the grouped data on a 200', async () => {
    const assignees = { districts: [{ id: 'd1', name: 'D1' }], schools: [], classes: [], groups: [] };
    mockGetAssignees.mockResolvedValueOnce({ status: 200, body: { data: assignees } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationAssigneesQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(assignees);
    expect(mockGetAssignees).toHaveBeenCalledWith({ params: { id: ADMIN_ID } });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockGetAssignees.mockResolvedValueOnce({ status: 403, body: { error: { code: 'forbidden' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationAssigneesQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({ status: 403 });
  });

  it('is disabled without an id', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAdministrationAssigneesQuery(ref(null)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });
});
