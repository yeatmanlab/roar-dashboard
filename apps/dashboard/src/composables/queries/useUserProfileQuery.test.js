import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { USER_PROFILE_QUERY_KEY } from '@/constants/queryKeys';
import useUserProfileQuery from './useUserProfileQuery';

const mockGetUser = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { get: mockGetUser },
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

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

// A representative slice of the flat API user response (UserResponseSchema).
const apiUser = {
  id: MOCK_USER_ID,
  email: 'student@example.org',
  username: 'student1',
  userType: 'student',
  assessmentPid: 'abc123',
  nameFirst: 'Ada',
  nameMiddle: 'B',
  nameLast: 'Lovelace',
  dob: '2015-04-01',
  grade: '3',
  gender: 'female',
  statusEll: 'true',
  statusFrl: 'Free',
  statusIep: 'false',
  hispanicEthnicity: false,
  race: 'White, Asian',
  studentId: 'student-001',
  sisId: 'sis-001',
  stateId: 'state-001',
};

describe('useUserProfileQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockGetUser.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with a key composed of the profile key and userId', () => {
    vi.spyOn(VueQuery, 'useQuery');
    const userId = ref(MOCK_USER_ID);

    withSetup(() => useUserProfileQuery(userId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [USER_PROFILE_QUERY_KEY, userId],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests GET /users/:id and unwraps + maps the response', async () => {
    mockGetUser.mockResolvedValue({
      status: 200,
      body: { data: apiUser },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserProfileQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();

    expect(mockGetUser).toHaveBeenCalledWith({ params: { id: MOCK_USER_ID } });
    // Mapped to the legacy nested shape via mapUser.
    expect(result).toMatchObject({
      id: MOCK_USER_ID,
      name: { first: 'Ada', middle: 'B', last: 'Lovelace' },
      studentData: {
        dob: '2015-04-01',
        grade: '3',
        ell_status: 'true',
        frl_status: 'Free',
        race: ['White', 'Asian'],
        sis_id: 'sis-001',
        student_number: 'student-001',
      },
    });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockGetUser.mockResolvedValue({
      status: 404,
      body: { error: { message: 'Not found' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserProfileQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 404,
      body: { error: { message: 'Not found' } },
    });
  });

  it('is disabled when no userId is provided, even with a token', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserProfileQuery(ref('')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is disabled without an access token, even with a userId', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserProfileQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is enabled with both a token and a userId', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserProfileQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(true);
  });

  it('does not retry terminal auth errors', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserProfileQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const retry = VueQuery.useQuery.mock.calls[0][0].retry;
    const terminalAuthError = { body: { error: { code: 'auth/token-expired' } } };
    expect(retry(0, terminalAuthError)).toBe(false);
    // Transient errors retry up to the cap.
    expect(retry(0, new Error('boom'))).toBe(true);
  });
});
