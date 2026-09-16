import { describe, expect, it, vi } from 'vitest';
import { CONSENT_TYPES } from '@/constants/consentTypes';
import { loadDefaultResearchConsent } from './loadDefaultResearchConsent';

describe('loadDefaultResearchConsent', () => {
  it('loads and normalizes the existing approved English consent document', async () => {
    const getLegalDocument = vi.fn().mockResolvedValue({
      text: '# Stanford consent',
      version: '2026-01',
    });

    await expect(loadDefaultResearchConsent(getLegalDocument, 'en-US')).resolves.toEqual({
      id: CONSENT_TYPES.CONSENT_BEHAVIORAL_EYE_TRACKING,
      version: '2026-01',
      text: '# Stanford consent',
    });
    expect(getLegalDocument).toHaveBeenCalledWith(CONSENT_TYPES.CONSENT_BEHAVIORAL_EYE_TRACKING);
  });

  it('uses the approved Spanish consent source for Spanish locales', async () => {
    const getLegalDocument = vi.fn().mockResolvedValue({ text: '# Consentimiento' });

    await loadDefaultResearchConsent(getLegalDocument, 'es-CO');

    expect(getLegalDocument).toHaveBeenCalledWith(CONSENT_TYPES.CONSENT_BEHAVIORAL_EYE_TRACKING_ES);
  });

  it('rejects an empty legal document instead of presenting placeholder consent', async () => {
    await expect(loadDefaultResearchConsent(vi.fn().mockResolvedValue({ text: '' }))).rejects.toThrow(
      'approved research consent document is unavailable',
    );
  });
});
