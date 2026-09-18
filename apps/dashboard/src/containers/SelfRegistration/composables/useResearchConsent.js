import { ref } from 'vue';

/**
 * Owns the client-controlled acknowledgement values currently collected by
 * the account-owner form. Research-consent document state and modal behavior
 * are introduced by the consent-flow feature when they are consumed.
 *
 * @returns {Object} Reactive acknowledgement values and their mutation helpers.
 */
export function useResearchConsent() {
  const legalAccepted = ref(false);
  const futureContactAllowed = ref(false);

  function setLegalAccepted(value) {
    legalAccepted.value = Boolean(value);
  }

  function setFutureContactAllowed(value) {
    futureContactAllowed.value = Boolean(value);
  }

  return {
    legalAccepted,
    futureContactAllowed,
    setLegalAccepted,
    setFutureContactAllowed,
  };
}

export default useResearchConsent;
