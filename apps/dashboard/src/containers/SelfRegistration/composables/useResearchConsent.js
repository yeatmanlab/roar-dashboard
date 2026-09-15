import { computed, ref } from 'vue';

/**
 * Keeps legal acceptance, required research consent, and optional future
 * contact as three explicit decisions. Loading is dependency-injected because
 * the approved pre-auth consent source and version-storage contract are still
 * Stage 1 dependencies. The loader is intentionally independent of route and
 * invitation-code context; invitation codes belong to LearnerEnrollment.
 *
 * @returns {Object} Reactive consent state plus document-loading, modal, and
 * decision helpers.
 */
export function useResearchConsent() {
  const consentDocument = ref(null);
  const isLoading = ref(false);
  const loadError = ref(null);
  const isModalOpen = ref(false);
  const legalAccepted = ref(false);
  const researchConsentAccepted = ref(false);
  const futureContactAllowed = ref(false);

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
    researchConsentAccepted.value = true;
    closeModal();
  }

  function setLegalAccepted(value) {
    legalAccepted.value = Boolean(value);
  }

  function setFutureContactAllowed(value) {
    futureContactAllowed.value = Boolean(value);
  }

  return {
    consentDocument,
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
