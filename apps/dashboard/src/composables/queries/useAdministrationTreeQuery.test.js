import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATION_TREE_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationTreeQuery, {
  fetchAdministrationTreeLevel,
  fetchAdministrationTreeRootPage,
  toTreeTableNode,
} from './useAdministrationTreeQuery';

const mockGetTree = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ administrations: { getTree: mockGetTree } }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

const districtNode = {
  id: '00000000-0000-0000-0000-0000000000d1',
  name: 'District A',
  entityType: 'district',
  hasChildren: true,
  stats: {
    assignment: { studentsWithRequiredTasks: 10, studentsAssigned: 5, studentsStarted: 3, studentsCompleted: 2 },
  },
};

const treePage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useAdministrationTreeQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockGetTree.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  describe('toTreeTableNode', () => {
    it('maps entityType to orgType, adapts stats, and seeds a placeholder when hasChildren', () => {
      expect(toTreeTableNode(districtNode)).toEqual({
        key: districtNode.id,
        data: {
          id: districtNode.id,
          name: 'District A',
          orgType: 'district',
          stats: { assignment: { assigned: 5, started: 3, completed: 2 } },
        },
        children: [{ key: `${districtNode.id}-placeholder`, data: { name: 'Loading...', isPlaceholder: true } }],
      });
    });

    it('omits children and stats for a leaf node without stats', () => {
      const node = toTreeTableNode({ id: 'g1', name: 'Group', entityType: 'group', hasChildren: false });
      expect(node.children).toBeUndefined();
      expect(node.data.stats).toBeUndefined();
      expect(node.data.orgType).toBe('group');
    });
  });

  describe('fetchAdministrationTreeLevel', () => {
    it('requests the root level (no parent) with embed=stats and maps nodes', async () => {
      mockGetTree.mockResolvedValueOnce(treePage([districtNode]));

      const nodes = await fetchAdministrationTreeLevel(ADMIN_ID);

      expect(mockGetTree).toHaveBeenCalledWith({
        params: { id: ADMIN_ID },
        query: { page: 1, perPage: 100, embed: 'stats' },
      });
      expect(nodes[0].data.orgType).toBe('district');
      expect(nodes[0].data.stats.assignment).toEqual({ assigned: 5, started: 3, completed: 2 });
    });

    it("passes parent params when fetching a node's children", async () => {
      mockGetTree.mockResolvedValueOnce(treePage([]));

      await fetchAdministrationTreeLevel(ADMIN_ID, { parentEntityType: 'district', parentEntityId: districtNode.id });

      expect(mockGetTree).toHaveBeenCalledWith({
        params: { id: ADMIN_ID },
        query: {
          page: 1,
          perPage: 100,
          embed: 'stats',
          parentEntityType: 'district',
          parentEntityId: districtNode.id,
        },
      });
    });

    it('follows pagination across multiple pages', async () => {
      const second = { ...districtNode, id: 'd2', name: 'District B', hasChildren: false, stats: undefined };
      mockGetTree.mockResolvedValueOnce(treePage([districtNode], 2, 1)).mockResolvedValueOnce(treePage([second], 2, 2));

      const nodes = await fetchAdministrationTreeLevel(ADMIN_ID);

      expect(mockGetTree).toHaveBeenCalledTimes(2);
      expect(nodes).toHaveLength(2);
    });

    it('throws a structured error on non-200 responses', async () => {
      mockGetTree.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

      await expect(fetchAdministrationTreeLevel(ADMIN_ID)).rejects.toMatchObject({
        status: 500,
        body: { error: { code: 'internal' } },
      });
    });
  });

  describe('fetchAdministrationTreeRootPage', () => {
    it('requests a single root page (no parent) with the given page/perPage and embed=stats', async () => {
      mockGetTree.mockResolvedValueOnce(treePage([districtNode]));

      await fetchAdministrationTreeRootPage(ADMIN_ID, { page: 2, perPage: 25 });

      expect(mockGetTree).toHaveBeenCalledTimes(1);
      expect(mockGetTree).toHaveBeenCalledWith({
        params: { id: ADMIN_ID },
        query: { page: 2, perPage: 25, embed: 'stats' },
      });
    });

    it('defaults to page 1 with a default page size', async () => {
      mockGetTree.mockResolvedValueOnce(treePage([districtNode]));

      await fetchAdministrationTreeRootPage(ADMIN_ID);

      expect(mockGetTree).toHaveBeenCalledWith({
        params: { id: ADMIN_ID },
        query: { page: 1, perPage: 10, embed: 'stats' },
      });
    });

    it('returns mapped items plus the pagination envelope and does NOT page-walk', async () => {
      mockGetTree.mockResolvedValueOnce(treePage([districtNode], 3, 1));

      const result = await fetchAdministrationTreeRootPage(ADMIN_ID, { page: 1, perPage: 10 });

      // Only one request even though the server reports 3 total pages — root paging is
      // driven by the TreeTable paginator, not by walking every page here.
      expect(mockGetTree).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].data.orgType).toBe('district');
      expect(result.pagination).toEqual({ page: 1, perPage: 100, totalItems: 1, totalPages: 3 });
    });

    it('throws a structured error on non-200 responses', async () => {
      mockGetTree.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

      await expect(fetchAdministrationTreeRootPage(ADMIN_ID, { page: 1, perPage: 10 })).rejects.toMatchObject({
        status: 500,
        body: { error: { code: 'internal' } },
      });
    });
  });

  describe('useAdministrationTreeQuery', () => {
    it('keys on the administration id plus page/perPage refs (by reference)', () => {
      vi.spyOn(VueQuery, 'useQuery');

      const adminId = ref(ADMIN_ID);
      const page = ref(1);
      const perPage = ref(10);

      withSetup(() => useAdministrationTreeQuery(adminId, page, perPage), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(VueQuery.useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          // Refs are passed by reference so the key stays reactive across paging.
          queryKey: [ADMINISTRATION_TREE_QUERY_KEY, adminId, page, perPage],
          queryFn: expect.any(Function),
        }),
      );
    });

    it('fetches a single root page with the resolved page/perPage and resolves to { items, pagination }', async () => {
      mockGetTree.mockResolvedValueOnce(treePage([districtNode], 4, 2));

      let queryFn;
      vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
        queryFn = options.queryFn;
        return { data: { value: null }, error: { value: null } };
      });

      withSetup(() => useAdministrationTreeQuery(ref(ADMIN_ID), ref(2), ref(25)), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      const result = await queryFn();

      expect(mockGetTree).toHaveBeenCalledTimes(1);
      expect(mockGetTree).toHaveBeenCalledWith({
        params: { id: ADMIN_ID },
        query: { page: 2, perPage: 25, embed: 'stats' },
      });
      expect(result.items[0].data.orgType).toBe('district');
      expect(result.pagination.totalPages).toBe(4);
    });

    it('is disabled without an administration id', () => {
      vi.spyOn(VueQuery, 'useQuery');

      withSetup(() => useAdministrationTreeQuery(ref(null), ref(1), ref(10)), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
    });

    it('is disabled without an access token', () => {
      mockUseAuthStore.mockReturnValue({ accessToken: null });
      vi.spyOn(VueQuery, 'useQuery');

      withSetup(() => useAdministrationTreeQuery(ref(ADMIN_ID), ref(1), ref(10)), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
    });

    it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
      let retryFn;
      vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
        retryFn = options.retry;
        return { data: { value: null }, error: { value: null } };
      });

      withSetup(() => useAdministrationTreeQuery(ref(ADMIN_ID), ref(1), ref(10)), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
      expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
      expect(retryFn(0, new Error('network down'))).toBe(true);
      expect(retryFn(3, new Error('network down'))).toBe(false);
    });
  });
});
