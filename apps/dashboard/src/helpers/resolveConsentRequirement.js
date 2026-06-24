/**
 * Possible outcomes of resolving an administration's consent/assent requirement.
 *
 * @readonly
 * @enum {string}
 */
export const CONSENT_REQUIREMENT_STATUS = Object.freeze({
  // The administration's agreements have not resolved yet (loading or errored).
  // The caller MUST treat the student as "consent unresolved" and must NOT let
  // them proceed as if no consent were required. Fail toward blocking.
  UNRESOLVED: 'unresolved',
  // The administration requires no consent/assent agreement for this student's
  // age/grade. No gate.
  NOT_REQUIRED: 'not-required',
  // The administration requires a consent/assent agreement. See `shouldShow`.
  REQUIRED: 'required',
});

const ADULT_AGE = 18;
const SENIOR_GRADE = 12;
// Below these thresholds a student is too young to be shown the consent/assent
// form themselves (mirrors the pre-migration `age > 7 || grade > 1` gate).
const MIN_AGE_FOR_PROMPT = 7;
const MIN_GRADE_FOR_PROMPT = 1;

const CONSENT_TYPE = 'consent';
const ASSENT_TYPE = 'assent';

/**
 * Compute the student's age (in whole years, by calendar year) and grade from
 * the Firestore user document. Mirrors the pre-migration derivation exactly.
 * `userData` remains Firestore-sourced profile data (age/grade); only the
 * consent requirement and signed status now come from the backend.
 *
 * @param {Object|undefined} userData - The Firestore user document.
 * @returns {{ age: number, grade: number|undefined }}
 */
function deriveAgeAndGrade(userData) {
  const dob = new Date(userData?.studentData?.dob);
  const grade = userData?.studentData?.grade;
  const currentDate = new Date();
  const age = currentDate.getFullYear() - dob.getFullYear();
  return { age, grade };
}

/**
 * Decide whether the consent/assent gate must be shown for a student on the
 * selected administration, driven purely by the administration's required
 * agreements (from
 * `GET /users/:userId/administrations/:administrationId/agreements`) and the
 * server-computed `signed` flag on each agreement.
 *
 * This replaces the earlier firekit hybrid: there is no `getLegalDoc` lookup,
 * no `userData.legal` signed-status read, no agreement-name→Firestore-doc-ID
 * mapping, and no client-side renewal-date logic. The backend's `signed`
 * already encodes "the user has signed the current version" (annual re-consent
 * and version bumps are handled server-side).
 *
 * Authorization/compliance behavior:
 * - If the agreements query has not resolved successfully (`agreementsResolved`
 *   is false), returns `UNRESOLVED`. The caller must BLOCK — never proceed as
 *   if no consent is required while the requirement is unknown.
 * - The age/grade-selected agreement type is `consent` for adults / senior-grade
 *   students, otherwise `assent`. `tos` agreements are ignored here — they are
 *   gated elsewhere (via `/me` + the router guard).
 * - The administration requires consent/assent iff the agreements array contains
 *   an item whose `agreementType` matches the selected type. If none → no gate.
 * - The gate SHOWS when that agreement is unsigned (`signed === false`) and the
 *   student is old enough to be prompted. When found+unsigned+old-enough, the
 *   decision carries the agreement's `id` and its `currentVersion.id` so the
 *   caller can fetch the version content and record acceptance against the SAME
 *   version the gate checked.
 * - If that agreement is signed (`signed === true`), the gate does not show.
 *
 * @param {Object} args
 * @param {Array<{ id: string, name: string, agreementType: string, currentVersion: Object|null, signed: boolean }>|null|undefined} args.agreements
 *   The administration's required agreements, annotated with the user's signed status.
 * @param {boolean} args.agreementsResolved - True only when the agreements query
 *   has resolved successfully (not loading, not errored).
 * @param {Object|undefined} args.userData - The Firestore user document (age/grade).
 * @returns {Object} The consent requirement decision (see CONSENT_REQUIREMENT_STATUS).
 */
export function resolveConsentRequirement({ agreements, agreementsResolved, userData }) {
  // Requirement unknown until the agreements query resolves successfully. Block.
  if (!agreementsResolved) {
    return { status: CONSENT_REQUIREMENT_STATUS.UNRESOLVED };
  }

  const { age, grade } = deriveAgeAndGrade(userData);

  const isAdult = age >= ADULT_AGE;
  const isSeniorGrade = grade >= SENIOR_GRADE;
  const isOlder = isAdult || isSeniorGrade;
  const requiredAgreementType = isOlder ? CONSENT_TYPE : ASSENT_TYPE;

  // Select the age-appropriate consent/assent agreement; `tos` is intentionally
  // ignored here (gated elsewhere).
  const matchingAgreement = (agreements ?? []).find((agreement) => agreement?.agreementType === requiredAgreementType);

  // No matching agreement assigned → this administration requires no
  // consent/assent for this student. No gate.
  if (!matchingAgreement) {
    return { status: CONSENT_REQUIREMENT_STATUS.NOT_REQUIRED };
  }

  // The chosen agreement is required. `signed` is the server's verdict on
  // whether the user has signed the current version — no client-side
  // renewal-date or version-key logic.
  const hasSignedCurrentVersion = matchingAgreement.signed === true;

  const isOldEnoughToPrompt = age > MIN_AGE_FOR_PROMPT || grade > MIN_GRADE_FOR_PROMPT;

  // Show the gate whenever the student has not signed the current version and is
  // old enough to be prompted.
  const shouldShow = !hasSignedCurrentVersion && isOldEnoughToPrompt;

  const versionId = matchingAgreement.currentVersion?.id ?? null;

  // Required + unsigned but no current version available to present → we cannot
  // show a signable consent form. Fail safe: block (UNRESOLVED) rather than
  // resolving the gate open with an unpresentable required consent.
  if (shouldShow && !versionId) {
    return { status: CONSENT_REQUIREMENT_STATUS.UNRESOLVED };
  }

  return {
    status: CONSENT_REQUIREMENT_STATUS.REQUIRED,
    consentType: requiredAgreementType,
    // The IDs the caller needs to fetch the version content and record
    // acceptance against the SAME version the gate checked.
    agreementId: matchingAgreement.id,
    versionId,
    shouldShow,
  };
}
