import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import useAdministrationsStatsQuery from './useAdministrationsStatsQuery';

const mockGetAssignmentStats = vi.fn();

vi.mock('pinia', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    storeToRefs: vi.fn(() => ({
      roarfirekit: ref({
        getAssignmentStats: mockGetAssignmentStats,
      }),
    })),
  };
});

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() => ({})),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useAdministrationsStatsQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    vi.clearAllMocks();
    mockGetAssignmentStats.mockResolvedValue({
      data: {
        admin1: { completed: 10, started: 5, assigned: 3 },
        admin2: { completed: 8, started: 2, assigned: 1 },
      },
    });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters when no orgId is passed in', () => {
    const mockAdministrationIds = ref([nanoid(), nanoid(), nanoid()]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, null, null, false), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations-stats', mockAdministrationIds, null, null, null, false],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });
  });

  it('should call query with correct parameters when orgId and orgType are passed in', () => {
    const mockAdministrationIds = ref([nanoid(), nanoid(), nanoid()]);
    vi.spyOn(VueQuery, 'useQuery');

    const orgId = ref('123456');
    const orgType = ref('district');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, orgId, orgType, null, false), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations-stats', mockAdministrationIds, orgId, orgType, null, false],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });
  });

  it('should call getAssignmentStats with correct parameters including orgType', async () => {
    const mockAdministrationIds = ref(['admin1', 'admin2']);
    const orgId = ref('org123');
    const orgType = ref('school');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, orgId, orgType, null, false), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Wait for query to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockGetAssignmentStats).toHaveBeenCalledWith({
      administrationIds: ['admin1', 'admin2'],
      orgId: 'org123',
      orgType: 'school',
    });
  });

  it('should not include orgId/orgType when not provided', async () => {
    const mockAdministrationIds = ref(['admin1', 'admin2']);

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, null, null, false), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Wait for query to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockGetAssignmentStats).toHaveBeenCalledWith({
      administrationIds: ['admin1', 'admin2'],
    });
  });

  it('should transform firekit response to array format', async () => {
    const mockAdministrationIds = ref(['admin1', 'admin2']);
    mockGetAssignmentStats.mockResolvedValue({
      data: {
        admin1: { completed: 10, started: 5, assigned: 3 },
        admin2: { completed: 8, started: 2, assigned: 1 },
      },
    });

    let queryResult;
    withSetup(
      () => {
        queryResult = useAdministrationsStatsQuery(mockAdministrationIds, null, null, null, false);
      },
      {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      },
    );

    // Wait for query to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(queryResult.data.value).toEqual([
      { completed: 10, started: 5, assigned: 3 },
      { completed: 8, started: 2, assigned: 1 },
    ]);
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const mockAdministrationIds = ref([nanoid(), nanoid(), nanoid()]);
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, null, null, false, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations-stats', mockAdministrationIds, null, null, null, false],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(mockGetAssignmentStats).not.toHaveBeenCalled();
  });

  it('should only fetch data if the administration IDs are available', async () => {
    const mockAdministrationIds = ref(null);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, null, null, false, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations-stats', mockAdministrationIds, null, null, null, false],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(mockGetAssignmentStats).not.toHaveBeenCalled();
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const mockAdministrationIds = ref(null);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, null, null, false, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations-stats', mockAdministrationIds, null, null, null, false],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(mockGetAssignmentStats).not.toHaveBeenCalled();
  });

  it('should include taskIds when provided', async () => {
    const mockAdministrationIds = ref(['admin1']);
    const taskIds = ref(['swr', 'pa']);

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, null, taskIds, false), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Wait for query to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockGetAssignmentStats).toHaveBeenCalledWith({
      administrationIds: ['admin1'],
      taskIds: ['swr', 'pa'],
    });
  });

  it('should include fetchAllTaskIds when true', async () => {
    const mockAdministrationIds = ref(['admin1']);

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, null, null, true), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Wait for query to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockGetAssignmentStats).toHaveBeenCalledWith({
      administrationIds: ['admin1'],
      fetchAllTaskIds: true,
    });
  });

  it('should include all parameters when provided', async () => {
    const mockAdministrationIds = ref(['admin1']);
    const orgId = ref('org123');
    const orgType = ref('school');
    const taskIds = ref(['swr']);

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, orgId, orgType, taskIds, false), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Wait for query to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockGetAssignmentStats).toHaveBeenCalledWith({
      administrationIds: ['admin1'],
      orgId: 'org123',
      orgType: 'school',
      taskIds: ['swr'],
    });
  });

  it('should throw an error when orgId is provided without orgType', async () => {
    const mockAdministrationIds = ref(['admin1']);
    const orgId = ref('org123');

    let queryResult;
    withSetup(
      () => {
        queryResult = useAdministrationsStatsQuery(mockAdministrationIds, orgId, null, null, false);
      },
      {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      },
    );

    // Wait for query to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The query should be in error state
    expect(queryResult.isError.value).toBe(true);
    expect(queryResult.error.value?.message).toBe('orgType is required when orgId is provided');
  });

  it('should not throw an error when orgType is provided without orgId', async () => {
    const mockAdministrationIds = ref(['admin1']);
    const orgType = ref('school');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, orgType, null, false), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Wait for query to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should only include administrationIds, not orgId/orgType
    expect(mockGetAssignmentStats).toHaveBeenCalledWith({
      administrationIds: ['admin1'],
    });
  });
});
