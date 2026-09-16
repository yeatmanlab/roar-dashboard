import { CONSENT_TYPES } from '@/constants/consentTypes';

/**
 * The explicit acknowledgement text already used by ROAR research tasks.
 * Keep this language verbatim unless an IRB-approved revision replaces it.
 */
export const RESEARCH_CONSENT_ACKNOWLEDGEMENT =
  'I agree to participate in this research. Participation in this research is voluntary, and I can stop at any time without penalty. I feel that I understand what I am getting into, and I know I am free to discontinue the experiment with no consequence to myself and/or my child.';

/**
 * Converts known legal-document timestamps or version values to a stable string.
 *
 * @param {unknown} value Legal-document version metadata.
 * @returns {string|null} A serializable version identifier when available.
 */
function normalizeVersion(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return null;
}

/**
 * Loads the approved default ROAR research-consent document from the same legal
 * document source used by the legacy registration flow.
 *
 * @param {(documentId: string) => Promise<Object>} getLegalDocument Legal-document loader.
 * @param {string} [locale='en-US'] Active dashboard locale.
 * @returns {Promise<{id: string, version: string|null, text: string}>} Normalized consent document.
 */
export async function loadDefaultResearchConsent(getLegalDocument, locale = 'en-US') {
  const documentId = locale.startsWith('es')
    ? CONSENT_TYPES.CONSENT_BEHAVIORAL_EYE_TRACKING_ES
    : CONSENT_TYPES.CONSENT_BEHAVIORAL_EYE_TRACKING;
  const document = await getLegalDocument(documentId);

  if (typeof document?.text !== 'string' || !document.text.trim()) {
    throw new Error('The approved research consent document is unavailable.');
  }

  return {
    id: document.id ?? documentId,
    version: normalizeVersion(
      document.version ?? document.versionId ?? document.updatedAt ?? document.lastUpdated ?? document.effectiveDate,
    ),
    text: document.text,
  };
}

export default loadDefaultResearchConsent;
