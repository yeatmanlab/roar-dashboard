import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';

const FALLBACK_LOCALE = 'en-US';

/**
 * Pick the agreement version that best matches the user's current locale.
 *
 * Match order:
 *   1. Exact match against `i18n.global.locale.value` (e.g., `en-US` ↔ `en-US`).
 *   2. Language-only match (e.g., `es` matches `es-CO` when the user is set to `es`).
 *   3. Fallback to `en-US`.
 *   4. First available version as a last resort (shouldn't happen in practice
 *      because the backend guarantees at least one variant).
 *
 * @param {Array<{ versionId: string, locale: string }>} versions
 * @param {string} currentLocale
 * @returns {{ versionId: string, locale: string } | null}
 */
function pickVersionForLocale(versions, currentLocale) {
  if (!Array.isArray(versions) || versions.length === 0) return null;

  // Tolerate undefined/null currentLocale — fall straight through to en-US
  // fallback rather than throwing on the `.split('-')` below. Production
  // shouldn't hit this since `useI18n().locale.value` is always set, but it
  // keeps the helper safe for direct unit-test invocation.
  const safeLocale = typeof currentLocale === 'string' ? currentLocale : '';

  const exact = versions.find((v) => v.locale === safeLocale);
  if (exact) return exact;

  const languageOnly = safeLocale.split('-')[0];
  if (languageOnly) {
    const langMatch = versions.find((v) => v.locale.split('-')[0] === languageOnly);
    if (langMatch) return langMatch;
  }

  const fallback = versions.find((v) => v.locale === FALLBACK_LOCALE);
  if (fallback) return fallback;

  return versions[0];
}

/**
 * Orchestrates the TOS signing flow for the SignTos container.
 *
 * Exposes:
 *   - `unsignedAgreements`: ref to the raw list from `meData`.
 *   - `currentAgreement`: the next unsigned agreement to display (the first
 *     element of `unsignedAgreements`, or `null` if the list is empty).
 *   - `selectedVersion`: the version of `currentAgreement` whose locale best
 *     matches the user's current i18n locale.
 *   - `pickVersionForLocale`: exposed for unit testing the locale-matching logic.
 *
 * The container progresses through the queue by signing each agreement; the
 * `useRecordUserAgreementMutation` success handler invalidates the `/me` query
 * which causes `unsignedAgreements` to shrink and `currentAgreement` to
 * advance to the next entry. When the list is empty, the container's watcher
 * navigates to the originally-requested route (or home).
 */
export function useTosSigningFlow() {
  const authStore = useAuthStore();
  const { meData } = storeToRefs(authStore);
  const i18n = useI18n();

  const unsignedAgreements = computed(() => meData.value?.unsignedAgreements ?? []);

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
