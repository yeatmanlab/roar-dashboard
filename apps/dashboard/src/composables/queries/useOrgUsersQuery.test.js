import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { ORG_USERS_QUERY_KEY } from '@/constants/queryKeys';
import useOrgUsersQuery from './useOrgUsersQuery';

const mockListDistrictUsers = vi.fn();
const mockListSchoolUsers = vi.fn();
const mockListClassUsers = vi.fn();
const mockListGroupUsers = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    districts: { listUsers: mockListDistrictUsers },
    schools: { listUsers: mockListSchoolUsers },
    classes: { listUsers: mockListClassUsers },
    groups: { listUsers: mockListGroupUsers },
  }),
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

// A representative slice of an EnrolledUser API row (UserSchema + roles).
const apiEnrolledUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'student@example.org',
  username: 'student1',
  assessmentPid: 'abc123',
  nameFirst: 'Ada',
  nameLast: 'Lovelace',
  dob: '2015-04-01',
  grade: '3',
  gender: 'female',
  studentId: 'student-001',
  sisId: 'sis-001',
  stateId: 'state-001',
  localId: 'local-001',
  roles: ['student'],
};

const okResponse = {
  status: 200,
  body: {
    data: {
      items: [apiEnrolledUser],
      pagination: { page: 1, perPage: 25, totalItems: 1, totalPages: 1 },
    },
  },
};

describe('useOrgUsersQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    [mockListDistrictUsers, mockListSchoolUsers, mockListClassUsers, mockListGroupUsers].forEach((fn) => {
      fn.mockReset();
      fn.mockResolvedValue(okResponse);
    });
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('composes the query key from key, orgType, orgId, page, perPage, and sort', () => {
    vi.spyOn(VueQuery, 'useQuery');
    const orgType = ref('districts');
    const orgId = ref(nanoid());
    const page = ref(1);
    const perPage = ref(25);
    const sortBy = ref('nameLast');
    const sortOrder = ref('desc');

    withSetup(() => useOrgUsersQuery(orgType, orgId, page, perPage, sortBy, sortOrder), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ORG_USERS_QUERY_KEY, orgType, orgId, page, perPage, sortBy, sortOrder],
        queryFn: expect.any(Function),
      }),
    );
  });

  // The org type → endpoint + path-param dispatch is the correctness/security core
  // of this composable: the wrong mapping would query a different org type.
  const dispatchCases = [
    { orgType: 'districts', mock: () => mockListDistrictUsers, paramKey: 'districtId' },
    { orgType: 'schools', mock: () => mockListSchoolUsers, paramKey: 'schoolId' },
    { orgType: 'classes', mock: () => mockListClassUsers, paramKey: 'classId' },
    { orgType: 'groups', mock: () => mockListGroupUsers, paramKey: 'groupId' },
  ];

  it.each(dispatchCases)(
    'dispatches $orgType to its listUsers endpoint with the $paramKey path param and paging/sort query',
    async ({ orgType, mock, paramKey }) => {
      const orgId = 'org-id-123';

      let queryFn;
      vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
        queryFn = options.queryFn;
        return { data: { value: null }, error: { value: null } };
      });

      withSetup(() => useOrgUsersQuery(ref(orgType), ref(orgId), ref(2), ref(50), ref('username'), ref('asc')), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      await queryFn();

      // Only the matching org type's endpoint is called.
      expect(mock()).toHaveBeenCalledWith({
        params: { [paramKey]: orgId },
        query: { page: 2, perPage: 50, sortBy: 'username', sortOrder: 'asc' },
      });

      // No other org type's endpoint is hit.
      dispatchCases.filter((c) => c.orgType !== orgType).forEach((c) => expect(c.mock()).not.toHaveBeenCalled());
    },
  );

  it('unwraps the paginated envelope and maps rows to the legacy table shape', async () => {
    mockListDistrictUsers.mockResolvedValue(okResponse);

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useOrgUsersQuery(ref('districts'), ref('org-1'), ref(1), ref(25), ref('nameLast'), ref('desc')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();

    expect(result.pagination).toEqual({ page: 1, perPage: 25, totalItems: 1, totalPages: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: '00000000-0000-0000-0000-000000000001',
      username: 'student1',
      roles: ['student'],
      name: { first: 'Ada', last: 'Lovelace' },
      studentData: { grade: '3', gender: 'female', dob: '2015-04-01', state_id: 'state-001' },
    });
    // Retired/profile-only fields must not be surfaced on the list row.
    expect(result.items[0]).not.toHaveProperty('tags');
    expect(result.items[0]).not.toHaveProperty('testData');
    expect(result.items[0]).not.toHaveProperty('demoData');
    expect(result.items[0]).not.toHaveProperty('userType');
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListDistrictUsers.mockResolvedValue({
      status: 403,
      body: { error: { message: 'Forbidden' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useOrgUsersQuery(ref('districts'), ref('org-1'), ref(1), ref(25), ref('nameLast'), ref('desc')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 403,
      body: { error: { message: 'Forbidden' } },
    });
  });

  it('throws for an unsupported org type', async () => {
    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useOrgUsersQuery(ref('families'), ref('org-1'), ref(1), ref(25), ref('nameLast'), ref('desc')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toThrow(/unsupported org type/);
  });

  it('is disabled without an access token, even with orgType and orgId', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useOrgUsersQuery(ref('districts'), ref('org-1'), ref(1), ref(25), ref('nameLast'), ref('desc')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is disabled when orgType or orgId is missing, even with a token', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useOrgUsersQuery(ref('districts'), ref(''), ref(1), ref(25), ref('nameLast'), ref('desc')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is enabled with a token, orgType, and orgId', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useOrgUsersQuery(ref('districts'), ref('org-1'), ref(1), ref(25), ref('nameLast'), ref('desc')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(true);
  });

  it('respects a caller-supplied enabled=false', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(
      () =>
        useOrgUsersQuery(ref('districts'), ref('org-1'), ref(1), ref(25), ref('nameLast'), ref('desc'), {
          enabled: false,
        }),
      {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      },
    );

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('does not retry terminal auth errors but retries transient ones', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useOrgUsersQuery(ref('districts'), ref('org-1'), ref(1), ref(25), ref('nameLast'), ref('desc')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const retry = VueQuery.useQuery.mock.calls[0][0].retry;
    const terminalAuthError = { body: { error: { code: 'auth/token-expired' } } };
    expect(retry(0, terminalAuthError)).toBe(false);
    expect(retry(0, new Error('boom'))).toBe(true);
  });
});
