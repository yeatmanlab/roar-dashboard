import { ref, nextTick } from 'vue';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import useParticipantId from './useParticipantId';

// `useCurrentUser` wraps the `/me` query. Swap it for a ref-backed stand-in so
// tests can drive the resolved id directly and assert the composable stays
// reactive as `/me` settles.
const mockCurrentUserId = ref(undefined);

vi.mock('@/composables/useCurrentUser', () => ({
  default: () => ({ currentUserId: mockCurrentUserId }),
}));

describe('useParticipantId', () => {
  beforeEach(() => {
    mockCurrentUserId.value = undefined;
  });

  describe('self-launch path', () => {
    it('is undefined until `/me` resolves', () => {
      const [participantId] = withSetup(() => useParticipantId(null));

      // Consumers gate their per-user queries on truthiness, so this must not
      // fall back to anything (notably not the Firestore `roarUid`).
      expect(participantId.value).toBeUndefined();
    });

    it('resolves to the current user id once `/me` settles', async () => {
      const [participantId] = withSetup(() => useParticipantId(null));

      mockCurrentUserId.value = 'self-user-id';
      await nextTick();

      expect(participantId.value).toBe('self-user-id');
    });

    it('treats an undefined launchId the same as null', async () => {
      const [participantId] = withSetup(() => useParticipantId(undefined));

      mockCurrentUserId.value = 'self-user-id';
      await nextTick();

      expect(participantId.value).toBe('self-user-id');
    });
  });

  describe('proxy-launch path', () => {
    it('resolves to the launchId synchronously, without waiting on `/me`', () => {
      const [participantId] = withSetup(() => useParticipantId('child-user-id'));

      expect(participantId.value).toBe('child-user-id');
    });

    it('keeps the launchId even after `/me` resolves to the launching user', async () => {
      const [participantId] = withSetup(() => useParticipantId('child-user-id'));

      // The parent's own `/me` must never win over the child being launched —
      // that would attribute the child's runs to the parent.
      mockCurrentUserId.value = 'parent-user-id';
      await nextTick();

      expect(participantId.value).toBe('child-user-id');
    });
  });

  describe('reactive arguments', () => {
    it('accepts a ref for launchId and tracks its changes', async () => {
      const launchId = ref('first-child-id');
      const [participantId] = withSetup(() => useParticipantId(launchId));

      expect(participantId.value).toBe('first-child-id');

      launchId.value = 'second-child-id';
      await nextTick();

      expect(participantId.value).toBe('second-child-id');
    });

    it('falls back to the current user when a launchId ref clears', async () => {
      const launchId = ref('child-user-id');
      const [participantId] = withSetup(() => useParticipantId(launchId));
      mockCurrentUserId.value = 'self-user-id';

      launchId.value = null;
      await nextTick();

      expect(participantId.value).toBe('self-user-id');
    });

    it('accepts a getter for launchId', () => {
      const [participantId] = withSetup(() => useParticipantId(() => 'child-user-id'));

      expect(participantId.value).toBe('child-user-id');
    });
  });
});
