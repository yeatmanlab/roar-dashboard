import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import useCurrentUser from './useCurrentUser';

// `useMeQuery` is the underlying TanStack query. We swap it for a ref-backed
// stand-in so tests can drive `data.value` directly and assert that derived
// refs re-compute reactively.
const mockMeData = ref(undefined);
const mockMeStatus = ref('pending');
const mockMeError = ref(null);

vi.mock('@/composables/queries/useMeQuery', () => ({
  default: () => ({
    data: mockMeData,
    status: mockMeStatus,
    isPending: ref(false),
    isError: ref(false),
    isSuccess: ref(true),
    error: mockMeError,
  }),
}));

describe('useCurrentUser', () => {
  beforeEach(() => {
    mockMeData.value = undefined;
    mockMeStatus.value = 'pending';
    mockMeError.value = null;
  });

  it('exposes safe defaults when `/me` has not resolved', () => {
    const [result] = withSetup(() => useCurrentUser());

    expect(result.currentUserId.value).toBeUndefined();
    expect(result.hasUnsignedTos.value).toBe(false);
    expect(result.unsignedAgreements.value).toEqual([]);
  });

  it('exposes the `/me` payload after it resolves', async () => {
    const [result] = withSetup(() => useCurrentUser());

    mockMeData.value = {
      id: 'user-1',
      userType: 'student',
      nameFirst: 'First',
      nameLast: 'Last',
      unsignedAgreements: [{ agreementId: 'a1', agreementName: 'TOS', versions: [] }],
    };
    await nextTick();

    expect(result.currentUserId.value).toBe('user-1');
    expect(result.hasUnsignedTos.value).toBe(true);
    expect(result.unsignedAgreements.value).toHaveLength(1);
  });

  it('updates derived refs when the underlying `/me` data changes', async () => {
    const [result] = withSetup(() => useCurrentUser());

    mockMeData.value = {
      id: 'user-1',
      userType: 'student',
      nameFirst: 'First',
      nameLast: 'Last',
      unsignedAgreements: [{ agreementId: 'a1', agreementName: 'TOS', versions: [] }],
    };
    await nextTick();

    expect(result.hasUnsignedTos.value).toBe(true);

    // Simulate the user signing the agreement: `/me` invalidation refetches
    // with `unsignedAgreements` empty. The derived ref must flip back to
    // false so the SignTos container's watcher releases.
    mockMeData.value = {
      id: 'user-1',
      userType: 'student',
      nameFirst: 'First',
      nameLast: 'Last',
      unsignedAgreements: [],
    };
    await nextTick();

    expect(result.hasUnsignedTos.value).toBe(false);
  });

  it('treats a missing `unsignedAgreements` field as no unsigned TOS', async () => {
    const [result] = withSetup(() => useCurrentUser());

    mockMeData.value = {
      id: 'user-1',
      userType: 'student',
      nameFirst: 'First',
      nameLast: 'Last',
      // No `unsignedAgreements` field at all — should not throw, should
      // default to empty.
    };
    await nextTick();

    expect(result.hasUnsignedTos.value).toBe(false);
    expect(result.unsignedAgreements.value).toEqual([]);
  });

  it('passes through query status flags from the underlying query', async () => {
    const [result] = withSetup(() => useCurrentUser());

    // `data`, `status`, `isPending`, `isError`, `isSuccess`, `error` are
    // returned as-is — consumers depend on this for loading-gate logic.
    expect(result.data).toBe(mockMeData);
    expect(result.status).toBe(mockMeStatus);
    expect(result.error).toBe(mockMeError);
  });
});
