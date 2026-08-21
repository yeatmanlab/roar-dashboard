import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import useCurrentUser from '@/composables/useCurrentUser';
import { pickVersionForLocale } from './pickVersionForLocale';

/**
 * Orchestrates the TOS signing flow for the SignTos container.
 *
 * Exposes:
 *   - `unsignedAgreements`: ref to the raw list from `/me`.
 *   - `currentAgreement`: the next unsigned agreement to display (the first
 *     element of `unsignedAgreements`, or `null` if the list is empty).
 *   - `selectedVersion`: the version of `currentAgreement` whose locale best
 *     matches the user's current i18n locale.
 *   - `pickVersionForLocale`: re-exported here for tests that exercise the
 *     locale-matching logic via the flow composable.
 *
 * The container progresses through the queue by signing each agreement; the
 * `useRecordUserAgreementMutation` success handler invalidates the `/me` query
 * which causes `unsignedAgreements` to shrink and `currentAgreement` to
 * advance to the next entry. When the list is empty, the container's watcher
 * navigates to the originally-requested route (or home).
 */
export function useTosSigningFlow() {
  const { unsignedAgreements } = useCurrentUser();
  const i18n = useI18n();

  const currentAgreement = computed(() => unsignedAgreements.value[0] ?? null);

  const selectedVersion = computed(() => {
    if (!currentAgreement.value) return null;
    return pickVersionForLocale(currentAgreement.value.versions, i18n.locale.value);
  });

  return {
    unsignedAgreements,
    currentAgreement,
    selectedVersion,
    pickVersionForLocale,
  };
}
