import { computed, ref } from 'vue';

/**
 * Keeps legal acceptance, required research consent, and optional future
 * contact as three explicit decisions. Loading is dependency-injected because
 * the approved pre-auth consent source and version-storage contract are still
 * Stage 1 dependencies. The loader is intentionally independent of route and
 * invitation-code context; invitation codes belong to LearnerEnrollment.
 *
 * @param {Object} [options] Injectable consent dependencies.
 * @param {() => Date} [options.now] Clock used to timestamp confirmation.
 * @returns {Object} Reactive consent state plus document-loading, modal, and
 * decision helpers.
 */
export function useResearchConsent(options = {}) {
  const consentDocument = ref(null);
  // This is an ephemeral client-side decision record used to gate submission.
  // The strict create-family API does not currently accept consent metadata, so
  // this value is not durable and is discarded when the container unmounts.
  const consentRecord = ref(null);
  const isLoading = ref(false);
  const loadError = ref(null);
  const isModalOpen = ref(false);
  const legalAccepted = ref(false);
  const futureContactAllowed = ref(false);
  const now = options.now ?? (() => new Date());

  const researchConsentAccepted = computed(() => Boolean(consentRecord.value));
  const requiredAcknowledgementsComplete = computed(() => legalAccepted.value && researchConsentAccepted.value);

  async function loadConsent(loadDocument) {
    isLoading.value = true;
    loadError.value = null;
    try {
      consentDocument.value = await loadDocument();
      return consentDocument.value;
    } catch (error) {
      loadError.value = error instanceof Error ? error : new Error('Unable to load the research consent document.');
      throw loadError.value;
    } finally {
      isLoading.value = false;
    }
  }

  function openModal() {
    isModalOpen.value = true;
  }

  function closeModal() {
    isModalOpen.value = false;
  }

  function acceptResearchConsent() {
    if (!consentDocument.value) return false;

    consentRecord.value = {
      documentId: consentDocument.value.id,
      documentVersion: consentDocument.value.version ?? null,
      confirmedAt: now().toISOString(),
    };
    closeModal();
    return true;
  }

  function setLegalAccepted(value) {
    legalAccepted.value = Boolean(value);
  }

  function setFutureContactAllowed(value) {
    futureContactAllowed.value = Boolean(value);
  }

  return {
    consentDocument,
    consentRecord,
    isLoading,
    loadError,
    isModalOpen,
    legalAccepted,
    researchConsentAccepted,
    futureContactAllowed,
    requiredAcknowledgementsComplete,
    loadConsent,
    openModal,
    closeModal,
    acceptResearchConsent,
    setLegalAccepted,
    setFutureContactAllowed,
  };
}

export default useResearchConsent;
