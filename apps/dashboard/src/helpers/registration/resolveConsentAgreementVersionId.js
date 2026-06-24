import { StatusCodes } from 'http-status-codes';
import { AGREEMENT_TYPES } from '@/constants/agreements';

/**
 * Resolves the current consent agreement version id to record at ROAR@Home
 * registration.
 *
 * The legacy firekit flow recorded a single consent document
 * (`consent-behavioral-eye-tracking`, an `agreementType: 'consent'` doc) for the
 * caretaker and each child. The typed API has no field-level mapping from that
 * old document name; instead it identifies the consent agreement by
 * `agreementType === 'consent'` and records its `currentVersion.id`. This helper
 * page-walks `GET /v1/agreements?agreementType=consent`, selects the consent
 * agreement, and returns its current version id.
 *
 * Compliance: this is a hard requirement, not best-effort. If the catalog has no
 * consent agreement, or that agreement has no current version, this THROWS so
 * the registration saga aborts BEFORE creating any account — registration must
 * never proceed while silently failing to record consent.
 *
 * @param {Object} client - The ts-rest ROAR API client (from `getRoarApiClient`).
 * @param {number} [perPage=100] - Page size for the agreements list walk.
 * @returns {Promise<string>} The consent agreement's `currentVersion.id`.
 * @throws {Error} If the agreements request fails, or no current consent version exists.
 */
export async function resolveConsentAgreementVersionId(client, perPage = 100) {
  const agreements = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await client.agreements.list({
      query: { page, perPage, agreementType: AGREEMENT_TYPES.CONSENT },
    });

    if (result.status !== StatusCodes.OK) {
      const error = new Error(`Failed to fetch consent agreement with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    }

    agreements.push(...result.body.data.items);
    totalPages = result.body.data.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  const consent = agreements.find((agreement) => agreement.agreementType === AGREEMENT_TYPES.CONSENT);

  if (!consent || !consent.currentVersion || !consent.currentVersion.id) {
    throw new Error('No current consent agreement is available; registration cannot record consent.');
  }

  return consent.currentVersion.id;
}

export default resolveConsentAgreementVersionId;
