import { CONSENT_DATES } from '@/constants/consentDates';

/**
 * Check if the user has consented since the latest August 1st
 * @param {Array} userLegalDocs - Array of user legal documents
 * @returns {boolean} - True if user has consented since latest August 1st, false otherwise
 */
const checkConsentRenewalDate = (userLegalDocs) => {
  // Check if userLegalDocs exists and is an array
  if (!userLegalDocs || !Array.isArray(userLegalDocs)) {
    return false;
  }

  // Determine the start of the school year (August 1st).
  // If the current date is before August 1st, use the previous year's date.
  // @NOTE: We consider the school year to start on August 1st
  const currentDate = new Date();
  const latestAugust =
    currentDate.getMonth() < CONSENT_DATES.RENEWAL_MONTH - 1
      ? new Date(currentDate.getFullYear() - 1, CONSENT_DATES.RENEWAL_MONTH - 1, CONSENT_DATES.RENEWAL_DAY) // Previous year's August 1st
      : new Date(currentDate.getFullYear(), CONSENT_DATES.RENEWAL_MONTH - 1, CONSENT_DATES.RENEWAL_DAY); // Current year's August 1st
  // Check if any entry has a dateSigned more recent than the latest August 1st
  return userLegalDocs.some((doc) => {
    if (!doc.dateSigned) {
      return false;
    }

    const signedDate = new Date(doc.dateSigned);
    return signedDate > latestAugust;
  });
};

export { checkConsentRenewalDate };
