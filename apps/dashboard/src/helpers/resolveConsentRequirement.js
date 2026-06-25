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

// The participant agreement types the consent/assent gate is concerned with. The
// backend's agreements endpoint returns at most one of these for a given student
// — the age-appropriate one (consent for adults, assent for minors), selected by
// date of birth first and grade as a fallback. The dashboard consumes whichever
// it returns instead of re-deriving the consent-vs-assent choice itself.
const PARTICIPANT_AGREEMENT_TYPES = Object.freeze(['consent', 'assent']);
// Below these thresholds a student is too young to be shown the consent/assent
// form themselves (mirrors the pre-migration `age > 7 || grade > 1` gate).
const MIN_AGE_FOR_PROMPT = 7;
const MIN_GRADE_FOR_PROMPT = 1;

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
 * - The backend has already selected the age-appropriate agreement for this
 *   student (consent for adults, assent for minors), using date of birth first
 *   and grade as a fallback. The dashboard consumes whichever participant
 *   agreement it returned and does NOT re-derive the consent-vs-assent choice.
 *   `tos` agreements are ignored here — they are gated elsewhere (via `/me` + the
 *   router guard).
 * - The administration requires consent/assent iff the agreements array contains
 *   a participant agreement (`agreementType` of `consent` or `assent`). If none →
 *   no gate.
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

  // Consume whichever participant agreement the backend returned for this
  // student. The backend selects consent-vs-assent by age (date of birth first,
  // grade as a fallback); re-deriving it here from grade alone disagreed with the
  // backend for students whose grade and age imply different types — e.g. a
  // 17-year-old in grade 12, for whom the backend returns "assent" but the old
  // grade-only logic looked for "consent", matched nothing, and dropped the gate.
  // `tos` agreements are intentionally ignored here (gated elsewhere).
  const matchingAgreement = (agreements ?? []).find((agreement) =>
    PARTICIPANT_AGREEMENT_TYPES.includes(agreement?.agreementType),
  );

  // No matching agreement assigned → this administration requires no
  // consent/assent for this student. No gate.
  if (!matchingAgreement) {
    return { status: CONSENT_REQUIREMENT_STATUS.NOT_REQUIRED };
  }

  // The chosen agreement is required. `signed` is the server's verdict on
  // whether the user has signed the current version — no client-side
  // renewal-date or version-key logic.
  const hasSignedCurrentVersion = matchingAgreement.signed === true;

  // Age/grade is used ONLY to decide whether the student is old enough to be
  // shown the form themselves (mirrors the pre-migration `age > 7 || grade > 1`
  // gate) — never to choose between consent and assent (the backend does that).
  const { age, grade } = deriveAgeAndGrade(userData);
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
    consentType: matchingAgreement.agreementType,
    // The IDs the caller needs to fetch the version content and record
    // acceptance against the SAME version the gate checked.
    agreementId: matchingAgreement.id,
    versionId,
    shouldShow,
  };
}
