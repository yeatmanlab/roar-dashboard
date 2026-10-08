import { describe, expect, it } from 'vitest';
import { useResearchConsent } from './useResearchConsent';

describe('useResearchConsent', () => {
  it('initializes legal acceptance and optional future contact independently', () => {
    const consent = useResearchConsent();

    expect(consent.legalAccepted.value).toBe(false);
    expect(consent.futureContactAllowed.value).toBe(false);
  });

  it('normalizes acknowledgement updates to booleans', () => {
    const consent = useResearchConsent();

    consent.setLegalAccepted('accepted');
    consent.setFutureContactAllowed(1);
    expect(consent.legalAccepted.value).toBe(true);
    expect(consent.futureContactAllowed.value).toBe(true);

    consent.setLegalAccepted(null);
    consent.setFutureContactAllowed(undefined);
    expect(consent.legalAccepted.value).toBe(false);
    expect(consent.futureContactAllowed.value).toBe(false);
  });
});
