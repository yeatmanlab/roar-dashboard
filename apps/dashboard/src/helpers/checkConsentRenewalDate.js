import { CONSENT_DATES } from '@/constants/consentDates';

/**
 * Check if the user has consented since the latest August 1st
 * @param {Array} userLegalDocs - Array of user legal documents
 * @returns {boolean} - True if user has consented since latest August 1st, false otherwise
 */
export const checkConsentRenewalDate = (userLegalDocs) => {
  if (!userLegalDocs?.length || !Array.isArray(userLegalDocs)) return false;

  const renewalMonthIndex = CONSENT_DATES.RENEWAL_MONTH - 1;
  const renewalDay = CONSENT_DATES.RENEWAL_DAY;

  // Pacific midnight on Aug 1 == 07:00:00Z on Aug 1 (PDT)
  const getCutoffInUTCms = (year) => Date.UTC(year, renewalMonthIndex, renewalDay, 7, 0, 0, 0);

  const nowMs = Date.now();
  const thisYear = new Date().getUTCFullYear();

  // Decide which school year applies by comparing "now" to this year's cutoff.
  const cutoffThisYear = getCutoffInUTCms(thisYear);
  const cutoffPreviousYear = getCutoffInUTCms(thisYear - 1);
  const cutoffMs = nowMs < cutoffThisYear ? cutoffPreviousYear : cutoffThisYear;

  // Exclusive: must be strictly after the cutoff.
  return userLegalDocs.some((doc) => {
    const t = new Date(doc?.dateSigned).getTime();
    return Number.isFinite(t) && t > cutoffMs;
  });
};
