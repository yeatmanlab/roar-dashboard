import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConsentAgreementVersionId } from './resolveConsentAgreementVersionId';
import { AGREEMENT_TYPES } from '@/constants/agreements';

const mockList = vi.fn();
const client = { agreements: { list: (...args) => mockList(...args) } };

const consentPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

const consentAgreement = {
  id: 'agr-1',
  name: 'Standard Consent',
  agreementType: AGREEMENT_TYPES.CONSENT,
  currentVersion: { id: 'ver-1', locale: 'en-US' },
};

describe('resolveConsentAgreementVersionId', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it('returns the consent agreement currentVersion.id and filters by agreementType=consent', async () => {
    mockList.mockResolvedValueOnce(consentPage([consentAgreement]));

    await expect(resolveConsentAgreementVersionId(client)).resolves.toBe('ver-1');
    expect(mockList).toHaveBeenCalledWith({
      query: { page: 1, perPage: 100, agreementType: AGREEMENT_TYPES.CONSENT },
    });
  });

  it('walks all pages before selecting', async () => {
    mockList
      .mockResolvedValueOnce(
        consentPage(
          [{ ...consentAgreement, id: 'agr-x', agreementType: AGREEMENT_TYPES.CONSENT, currentVersion: null }],
          2,
          1,
        ),
      )
      .mockResolvedValueOnce(consentPage([consentAgreement], 2, 2));

    await expect(resolveConsentAgreementVersionId(client)).resolves.toBe('ver-1');
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('throws (does not silently skip) when no consent agreement exists', async () => {
    mockList.mockResolvedValueOnce(consentPage([]));
    await expect(resolveConsentAgreementVersionId(client)).rejects.toThrow(/consent/i);
  });

  it('throws when the consent agreement has no current version', async () => {
    mockList.mockResolvedValueOnce(consentPage([{ ...consentAgreement, currentVersion: null }]));
    await expect(resolveConsentAgreementVersionId(client)).rejects.toThrow(/consent/i);
  });

  it('throws a structured error when the agreements request fails', async () => {
    mockList.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });
    await expect(resolveConsentAgreementVersionId(client)).rejects.toMatchObject({ status: 500 });
  });
});
