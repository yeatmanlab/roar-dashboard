import { describe, expect, it, vi } from 'vitest';
import { useResearchConsent } from './useResearchConsent';

describe('useResearchConsent', () => {
  it('keeps required research consent separate from legal acceptance and optional contact', () => {
    const consent = useResearchConsent();
    consent.consentDocument.value = { id: 'consent-v1', version: 'v1' };
    consent.setLegalAccepted(true);

    expect(consent.futureContactAllowed.value).toBe(false);
    expect(consent.researchConsentAccepted.value).toBe(false);
    expect(consent.requiredAcknowledgementsComplete.value).toBe(false);

    consent.acceptResearchConsent();
    expect(consent.requiredAcknowledgementsComplete.value).toBe(true);

    consent.setFutureContactAllowed(true);
    expect(consent.requiredAcknowledgementsComplete.value).toBe(true);

    consent.setFutureContactAllowed(false);
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
    expect(loadDocument).toHaveBeenCalledWith();
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

  it('opens, closes, and records the exact document after explicit consent', () => {
    const consent = useResearchConsent({ now: () => new Date('2026-09-15T12:00:00.000Z') });
    consent.consentDocument.value = { id: 'consent-v1', version: '2026-09' };

    consent.openModal();
    expect(consent.isModalOpen.value).toBe(true);

    consent.closeModal();
    expect(consent.isModalOpen.value).toBe(false);

    consent.openModal();
    consent.acceptResearchConsent();
    expect(consent.researchConsentAccepted.value).toBe(true);
    expect(consent.consentRecord.value).toEqual({
      documentId: 'consent-v1',
      documentVersion: '2026-09',
      confirmedAt: '2026-09-15T12:00:00.000Z',
    });
    expect(consent.isModalOpen.value).toBe(false);
  });

  it('does not record consent when no approved document is loaded', () => {
    const consent = useResearchConsent();

    expect(consent.acceptResearchConsent()).toBe(false);
    expect(consent.consentRecord.value).toBeNull();
    expect(consent.researchConsentAccepted.value).toBe(false);
  });
});
