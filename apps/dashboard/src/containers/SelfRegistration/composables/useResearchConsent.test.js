import { describe, expect, it, vi } from 'vitest';
import { useResearchConsent } from './useResearchConsent';

describe('useResearchConsent', () => {
  it('keeps required research consent separate from legal acceptance and optional contact', () => {
    const consent = useResearchConsent();
    consent.setLegalAccepted(true);
    consent.setFutureContactAllowed(true);

    expect(consent.researchConsentAccepted.value).toBe(false);
    expect(consent.requiredAcknowledgementsComplete.value).toBe(false);

    consent.acceptResearchConsent();
    expect(consent.requiredAcknowledgementsComplete.value).toBe(true);
  });

  it('loads and stores the approved consent document', async () => {
    let resolveDocument;
    const document = { id: 'consent-v1' };
    const loadDocument = vi.fn(() => new Promise((resolve) => (resolveDocument = resolve)));
    const consent = useResearchConsent();

    const loading = consent.loadConsent(loadDocument);
    expect(consent.isLoading.value).toBe(true);
    expect(consent.loadError.value).toBeNull();

    resolveDocument(document);
    await expect(loading).resolves.toEqual(document);
    expect(consent.consentDocument.value).toEqual(document);
    expect(consent.isLoading.value).toBe(false);
  });

  it('exposes consent-loading failures and always clears the loading state', async () => {
    const loadError = new Error('Consent service unavailable');
    const consent = useResearchConsent();

    await expect(consent.loadConsent(vi.fn().mockRejectedValue(loadError))).rejects.toBe(loadError);

    expect(consent.loadError.value).toBe(loadError);
    expect(consent.isLoading.value).toBe(false);
    expect(consent.consentDocument.value).toBeNull();
  });

  it('opens, closes, and closes the modal after explicit consent', () => {
    const consent = useResearchConsent();

    consent.openModal();
    expect(consent.isModalOpen.value).toBe(true);

    consent.closeModal();
    expect(consent.isModalOpen.value).toBe(false);

    consent.openModal();
    consent.acceptResearchConsent();
    expect(consent.researchConsentAccepted.value).toBe(true);
    expect(consent.isModalOpen.value).toBe(false);
  });
});
