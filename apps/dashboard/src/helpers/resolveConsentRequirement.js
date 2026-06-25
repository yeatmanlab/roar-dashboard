import { checkConsentRenewalDate } from '@/helpers/checkConsentRenewalDate';

/**
 * Possible outcomes of resolving an administration's consent/assent requirement.
 *
 * @readonly
 * @enum {string}
 */
export const CONSENT_REQUIREMENT_STATUS = Object.freeze({
  // The administration's agreements have not resolved yet (loading or errored),
  // OR the required legal document could not be fetched. The caller MUST treat
  // the student as "consent unresolved" and must NOT let them proceed as if no
  // consent were required. Fail toward blocking.
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

/**
 * Compute the student's age (in whole years, by calendar year) and grade from
 * the Firestore user document. Mirrors the pre-migration derivation exactly.
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
 * selected administration, driven by the administration's required agreements
 * (from the `GET /administrations/:id/agreements` endpoint) rather than the
 * deprecated Firestore assignment `legal` block.
 *
 * Authorization/compliance behavior:
 * - If the agreements query has not resolved successfully (`agreementsResolved`
 *   is false), returns `UNRESOLVED`. The caller must BLOCK — never proceed as
 *   if no consent is required while the requirement is unknown.
 * - The administration requires consent/assent iff the agreements array contains
 *   an item whose `agreementType` matches the age/grade-selected type
 *   (`consent` for adults / senior-grade students, otherwise `assent`).
 * - The selected agreement's `name` is the legal-document identifier. It is used
 *   both as the argument to `getLegalDoc(...)` (a Firestore `legal/<name>` lookup)
 *   and as the key under `userData.legal[<name>]` — the same single identifier
 *   drives the document fetch, the signed-status read, and (downstream) the
 *   consent write, exactly as the pre-migration code used a single `docType`.
 * - Fail-safe: the absence of the legacy `amount`/`expectedTime` fields (which
 *   the new endpoint does not carry) must NOT suppress the gate. If the student
 *   has not signed the current version and is old enough, the gate shows.
 * - Fail-safe: if `getLegalDoc(...)` cannot resolve the document (returns
 *   nullish or throws), returns `UNRESOLVED` so the caller blocks rather than
 *   silently letting the student through.
 *
 * @param {Object} args
 * @param {Array<{ id: string, name: string, agreementType: string, currentVersion: Object|null }>|null|undefined} args.agreements
 *   The administration's required agreements (resolved value of the agreements query).
 * @param {boolean} args.agreementsResolved - True only when the agreements query
 *   has resolved successfully (not loading, not errored).
 * @param {Object|undefined} args.userData - The Firestore user document (age/grade + signed status).
 * @param {(docName: string) => Promise<{ text: string, version: string }|null>} args.getLegalDoc
 *   Resolves the legal document text + version for a doc name.
 * @returns {Promise<Object>} The consent requirement decision (see CONSENT_REQUIREMENT_STATUS).
 */
export async function resolveConsentRequirement({ agreements, agreementsResolved, userData, getLegalDoc }) {
  // Requirement unknown until the agreements query resolves successfully. Block.
  if (!agreementsResolved) {
    return { status: CONSENT_REQUIREMENT_STATUS.UNRESOLVED };
  }

  const { age, grade } = deriveAgeAndGrade(userData);

  const isAdult = age >= ADULT_AGE;
  const isSeniorGrade = grade >= SENIOR_GRADE;
  const isOlder = isAdult || isSeniorGrade;
  const requiredAgreementType = isOlder ? 'consent' : 'assent';

  const matchingAgreement = (agreements ?? []).find((agreement) => agreement?.agreementType === requiredAgreementType);

  // No matching agreement assigned → this administration requires no
  // consent/assent for this student. No gate (mirrors `if (!legal?.consent) return`).
  if (!matchingAgreement) {
    return { status: CONSENT_REQUIREMENT_STATUS.NOT_REQUIRED };
  }

  // The agreement `name` is the legal-document identifier. The same value is
  // used for the Firestore document lookup, the signed-status read key, and the
  // consent write key, so they always refer to the same document.
  const consentType = matchingAgreement.name;

  let consentDoc;
  try {
    consentDoc = await getLegalDoc(consentType);
  } catch {
    // Could not fetch the legal document → requirement unresolved. Block.
    return { status: CONSENT_REQUIREMENT_STATUS.UNRESOLVED };
  }

  // getLegalDoc returns null when the document does not exist. We cannot prove
  // the student has consented, so fail toward blocking rather than skipping.
  if (!consentDoc?.version) {
    return { status: CONSENT_REQUIREMENT_STATUS.UNRESOLVED };
  }

  const consentVersion = consentDoc.version;
  const signedForVersion = userData?.legal?.[consentType]?.[consentVersion];

  // "Signed the current version" means: a signature record exists for this
  // version AND it is on or after the latest annual renewal date (Aug 1).
  const hasSignedCurrentVersion = Boolean(signedForVersion) && checkConsentRenewalDate(signedForVersion);

  const isOldEnoughToPrompt = age > MIN_AGE_FOR_PROMPT || grade > MIN_GRADE_FOR_PROMPT;

  // Fail-safe: show the gate whenever the student has not signed the current
  // version and is old enough — regardless of the (now-absent) amount /
  // expectedTime fields.
  const shouldShow = !hasSignedCurrentVersion && isOldEnoughToPrompt;

  return {
    status: CONSENT_REQUIREMENT_STATUS.REQUIRED,
    consentType,
    consentVersion,
    consentText: consentDoc.text,
    shouldShow,
  };
}
