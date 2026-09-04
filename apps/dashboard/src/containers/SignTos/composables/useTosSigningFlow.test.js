import { ref, computed, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import { useTosSigningFlow } from './useTosSigningFlow';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en-US' },
  }),
}));

// Stand-in for the `/me` query payload. `useCurrentUser` is mocked to derive
// `unsignedAgreements` from this ref, so tests drive the same reactivity the
// production code sees from TanStack Query by writing to `mockMeData.value`.
const mockMeData = ref(null);

vi.mock('@/composables/useCurrentUser', () => ({
  default: () => ({
    unsignedAgreements: computed(() => mockMeData.value?.unsignedAgreements ?? []),
  }),
}));

describe('useTosSigningFlow', () => {
  beforeEach(() => {
    mockMeData.value = null;
  });

  describe('pickVersionForLocale', () => {
    let pickVersionForLocale;

    beforeEach(() => {
      const [result] = withSetup(() => useTosSigningFlow());
      pickVersionForLocale = result.pickVersionForLocale;
    });

    it('returns the exact-match version when available', () => {
      const versions = [
        { versionId: 'v-en', locale: 'en-US' },
        { versionId: 'v-es', locale: 'es-CO' },
      ];
      expect(pickVersionForLocale(versions, 'es-CO')).toEqual({ versionId: 'v-es', locale: 'es-CO' });
    });

    it('falls back to a language-only match when no exact-locale match exists', () => {
      const versions = [
        { versionId: 'v-en', locale: 'en-US' },
        { versionId: 'v-es-co', locale: 'es-CO' },
      ];
      // User locale is `es` (no region) — should match the `es-CO` variant by language code.
      expect(pickVersionForLocale(versions, 'es')).toEqual({ versionId: 'v-es-co', locale: 'es-CO' });
    });

    it('falls back to en-US when neither exact nor language match exists', () => {
      const versions = [
        { versionId: 'v-en-us', locale: 'en-US' },
        { versionId: 'v-fr', locale: 'fr-FR' },
      ];
      expect(pickVersionForLocale(versions, 'de-DE')).toEqual({ versionId: 'v-en-us', locale: 'en-US' });
    });

    it('returns the first available version when no preferred match exists', () => {
      const versions = [
        { versionId: 'v-fr', locale: 'fr-FR' },
        { versionId: 'v-de', locale: 'de-DE' },
      ];
      expect(pickVersionForLocale(versions, 'ja-JP')).toEqual({ versionId: 'v-fr', locale: 'fr-FR' });
    });

    it('returns null for an empty versions array', () => {
      expect(pickVersionForLocale([], 'en-US')).toBeNull();
    });

    it('returns null for a non-array input', () => {
      expect(pickVersionForLocale(undefined, 'en-US')).toBeNull();
      expect(pickVersionForLocale(null, 'en-US')).toBeNull();
    });
  });

  describe('currentAgreement / selectedVersion', () => {
    it('returns null when /me has no unsigned agreements', () => {
      const [result] = withSetup(() => useTosSigningFlow());
      expect(result.currentAgreement.value).toBeNull();
      expect(result.selectedVersion.value).toBeNull();
    });

    it('advances through the queue as agreements are signed', async () => {
      // Seed two unsigned agreements; the flow should expose the first as
      // `currentAgreement`, then the second after the first is removed from
      // the `/me` payload. The container relies on this reactivity to drive
      // the sign-each-then-navigate behavior.
      const [result] = withSetup(() => useTosSigningFlow());

      const firstAgreement = {
        agreementId: 'agreement-1',
        agreementName: 'Terms of Service',
        versions: [{ versionId: 'v1-en', locale: 'en-US' }],
      };
      const secondAgreement = {
        agreementId: 'agreement-2',
        agreementName: 'Privacy Policy',
        versions: [{ versionId: 'v2-en', locale: 'en-US' }],
      };

      mockMeData.value = {
        id: 'u1',
        userType: 'student',
        nameFirst: 'A',
        nameLast: 'B',
        unsignedAgreements: [firstAgreement, secondAgreement],
      };
      await nextTick();

      expect(result.currentAgreement.value).toEqual(firstAgreement);
      expect(result.selectedVersion.value).toEqual({ versionId: 'v1-en', locale: 'en-US' });

      // Simulate a successful sign: the `/me` invalidation refetches with one
      // fewer unsigned agreement.
      mockMeData.value = {
        id: 'u1',
        userType: 'student',
        nameFirst: 'A',
        nameLast: 'B',
        unsignedAgreements: [secondAgreement],
      };
      await nextTick();

      expect(result.currentAgreement.value).toEqual(secondAgreement);
      expect(result.selectedVersion.value).toEqual({ versionId: 'v2-en', locale: 'en-US' });

      // Final sign — queue is empty.
      mockMeData.value = {
        id: 'u1',
        userType: 'student',
        nameFirst: 'A',
        nameLast: 'B',
        unsignedAgreements: [],
      };
      await nextTick();

      expect(result.currentAgreement.value).toBeNull();
      expect(result.selectedVersion.value).toBeNull();
    });
  });
});
