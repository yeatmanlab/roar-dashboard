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

  it('uses the approved default English consent source for Portuguese locales', async () => {
    const getLegalDocument = vi.fn().mockResolvedValue({ text: '# Consentimento disponível em inglês' });

    await loadDefaultResearchConsent(getLegalDocument, 'pt-BR');

    expect(getLegalDocument).toHaveBeenCalledWith(CONSENT_TYPES.CONSENT_BEHAVIORAL_EYE_TRACKING);
  });

  it('normalizes Firestore Timestamp-like versions through toDate', async () => {
    const timestamp = { toDate: vi.fn(() => new Date('2026-02-03T04:05:06.000Z')) };

    await expect(
      loadDefaultResearchConsent(vi.fn().mockResolvedValue({ text: '# Stanford consent', updatedAt: timestamp })),
    ).resolves.toMatchObject({ version: '2026-02-03T04:05:06.000Z' });
    expect(timestamp.toDate).toHaveBeenCalledOnce();
  });

  it('normalizes Firestore Timestamp-like versions through epoch seconds', async () => {
    const seconds = Date.UTC(2026, 1, 3, 4, 5, 6) / 1000;

    await expect(
      loadDefaultResearchConsent(vi.fn().mockResolvedValue({ text: '# Stanford consent', updatedAt: { seconds } })),
    ).resolves.toMatchObject({ version: '2026-02-03T04:05:06.000Z' });
  });

  it('rejects an empty legal document instead of presenting placeholder consent', async () => {
    await expect(loadDefaultResearchConsent(vi.fn().mockResolvedValue({ text: '' }))).rejects.toThrow(
      'approved research consent document is unavailable',
    );
  });
});
