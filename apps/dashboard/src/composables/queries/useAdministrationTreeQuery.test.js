import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATION_TREE_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationTreeQuery, {
  fetchAdministrationTreeLevel,
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

  describe('useAdministrationTreeQuery', () => {
    it('calls useQuery with the tree query key', () => {
      vi.spyOn(VueQuery, 'useQuery');

      withSetup(() => useAdministrationTreeQuery(ref(ADMIN_ID)), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(VueQuery.useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: [ADMINISTRATION_TREE_QUERY_KEY, expect.anything()],
          queryFn: expect.any(Function),
        }),
      );
    });

    it('is disabled without an administration id', () => {
      vi.spyOn(VueQuery, 'useQuery');

      withSetup(() => useAdministrationTreeQuery(ref(null)), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
    });

    it('is disabled without an access token', () => {
      mockUseAuthStore.mockReturnValue({ accessToken: null });
      vi.spyOn(VueQuery, 'useQuery');

      withSetup(() => useAdministrationTreeQuery(ref(ADMIN_ID)), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
    });
  });
});
