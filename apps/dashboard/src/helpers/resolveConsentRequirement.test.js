import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveConsentRequirement, CONSENT_REQUIREMENT_STATUS } from './resolveConsentRequirement';

// A fixed "now" so age derivation is deterministic.
const NOW = new Date('2026-06-23T12:00:00.000Z');

// Born 2008 → age 2026 - 2008 = 18 (an adult). The backend returns the "consent"
// agreement for this student.
const ADULT_DOB = '2008-03-15';
// Born 2016 → age 2026 - 2016 = 10 (a minor). The backend returns the "assent"
// agreement for this student.
const MINOR_DOB = '2016-03-15';
// Born 2009 → age 2026 - 2009 = 17: a *minor* who is nonetheless in a senior
// grade. The backend (date-of-birth first) returns "assent"; the old grade-only
// frontend logic wrongly derived "consent". The realistic regression case.
const SENIOR_MINOR_DOB = '2009-03-15';
// Born 2020 → age 6 (and grade 0 in fixtures) → too young to be prompted.
const YOUNG_DOB = '2020-03-15';

// Agreement objects as returned by
// GET /users/:userId/administrations/:administrationId/agreements — each carries
// a server-computed `signed` flag (true = signed current version). Note the
// absence of any amount/expectedTime fields and any client-side version key.
const consentAgreement = ({ signed }) => ({
  id: 'agreement-consent-id',
  name: 'consent-behavioral-eye-tracking',
  agreementType: 'consent',
  currentVersion: { id: 'v-consent', locale: 'en-US' },
  signed,
});
const assentAgreement = ({ signed }) => ({
  id: 'agreement-assent-id',
  name: 'assent-behavioral-eye-tracking',
  agreementType: 'assent',
  currentVersion: { id: 'v-assent', locale: 'en-US' },
  signed,
});
const tosAgreement = ({ signed }) => ({
  id: 'agreement-tos-id',
  name: 'tos',
  agreementType: 'tos',
  currentVersion: { id: 'v-tos', locale: 'en-US' },
  signed,
});

/**
 * Build a userData document with a given dob/grade. Only age/grade is read by
 * the helper now — signed status comes from the agreements, not `userData.legal`.
 */
const buildUserData = ({ dob, grade } = {}) => ({
  id: 'student-1',
  studentData: { dob, grade },
});

describe('resolveConsentRequirement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('(d) unresolved agreements: the student is never treated as consent-free', () => {
    it('returns UNRESOLVED when the agreements query has not resolved', () => {
      const result = resolveConsentRequirement({
        agreements: undefined,
        agreementsResolved: false,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.UNRESOLVED);
    });

    it('returns UNRESOLVED even when an unsigned required agreement is present but the query is unresolved', () => {
      const result = resolveConsentRequirement({
        agreements: [consentAgreement({ signed: false })],
        agreementsResolved: false,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.UNRESOLVED);
    });

    it('returns UNRESOLVED when a required, unsigned agreement has no current version to present', () => {
      // Fail safe: an unsigned required consent with a null currentVersion can't
      // be shown or signed — block rather than resolve the gate open.
      const result = resolveConsentRequirement({
        agreements: [{ ...consentAgreement({ signed: false }), currentVersion: null }],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.UNRESOLVED);
    });
  });

  describe('(b) administration requires no matching agreement: no gate', () => {
    it('returns NOT_REQUIRED when the agreements array is empty', () => {
      const result = resolveConsentRequirement({
        agreements: [],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.NOT_REQUIRED);
    });

    it('ignores a `tos` agreement entirely (tos is gated elsewhere)', () => {
      // Only a tos agreement is present; neither consent nor assent → no gate
      // here regardless of the student's age.
      const result = resolveConsentRequirement({
        agreements: [tosAgreement({ signed: false })],
        agreementsResolved: true,
        userData: buildUserData({ dob: MINOR_DOB, grade: 4 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.NOT_REQUIRED);
    });
  });

  describe('(c) the dashboard consumes the backend-selected participant agreement (does NOT re-derive consent vs assent)', () => {
    it('uses the consent agreement the backend returned for an adult', () => {
      // The backend selects the age-appropriate agreement; for an adult it
      // returns "consent" (alongside an unrelated ToS the gate ignores).
      const result = resolveConsentRequirement({
        agreements: [consentAgreement({ signed: false }), tosAgreement({ signed: false })],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 4 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.consentType).toBe('consent');
      expect(result.agreementId).toBe('agreement-consent-id');
      expect(result.versionId).toBe('v-consent');
    });

    it('uses the assent agreement the backend returned for a senior-grade minor (grade 12, age < 18) — the gate is NOT dropped', () => {
      // Regression for the consent-vs-assent discrepancy: a 17-year-old in grade
      // 12 is a minor by date of birth, so the backend returns "assent". The
      // dashboard must use it rather than re-deriving "consent" from grade >= 12
      // (which would match nothing in the backend-filtered list → no gate).
      const result = resolveConsentRequirement({
        agreements: [assentAgreement({ signed: false })],
        agreementsResolved: true,
        userData: buildUserData({ dob: SENIOR_MINOR_DOB, grade: 12 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.consentType).toBe('assent');
      expect(result.agreementId).toBe('agreement-assent-id');
      expect(result.versionId).toBe('v-assent');
    });

    it('uses the assent agreement the backend returned for a minor', () => {
      const result = resolveConsentRequirement({
        agreements: [assentAgreement({ signed: false }), tosAgreement({ signed: false })],
        agreementsResolved: true,
        userData: buildUserData({ dob: MINOR_DOB, grade: 4 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.consentType).toBe('assent');
      expect(result.agreementId).toBe('agreement-assent-id');
      expect(result.versionId).toBe('v-assent');
    });
  });

  describe('(a) gate shows when a required agreement is unsigned for the current version', () => {
    it('shows the gate when the required agreement is unsigned', () => {
      const result = resolveConsentRequirement({
        agreements: [assentAgreement({ signed: false })],
        agreementsResolved: true,
        userData: buildUserData({ dob: MINOR_DOB, grade: 4 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(true);
      expect(result.agreementId).toBe('agreement-assent-id');
      expect(result.versionId).toBe('v-assent');
    });

    it('does NOT show the gate when the required agreement is signed', () => {
      const result = resolveConsentRequirement({
        agreements: [assentAgreement({ signed: true })],
        agreementsResolved: true,
        userData: buildUserData({ dob: MINOR_DOB, grade: 4 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(false);
    });

    it('does NOT show the gate for a student too young to be prompted (age <= 7 and grade <= 1), even when unsigned', () => {
      const result = resolveConsentRequirement({
        agreements: [assentAgreement({ signed: false })],
        agreementsResolved: true,
        userData: buildUserData({ dob: YOUNG_DOB, grade: 0 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(false);
    });
  });

  describe('amount/expectedTime absence must not suppress the gate (fail-safe)', () => {
    it('shows the gate for an unsigned, old-enough student with no legacy amount/expectedTime data anywhere', () => {
      // The new agreement objects carry no amount/expectedTime fields at all.
      const result = resolveConsentRequirement({
        agreements: [consentAgreement({ signed: false })],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 4 }),
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(true);
    });
  });
});
