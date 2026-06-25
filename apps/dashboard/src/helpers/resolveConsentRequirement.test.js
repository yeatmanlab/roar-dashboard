import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveConsentRequirement, CONSENT_REQUIREMENT_STATUS } from './resolveConsentRequirement';

// A fixed "now" so age derivation and the Aug-1 renewal cutoff are deterministic.
// 2026-06-23 is BEFORE Aug 1 2026, so the applicable renewal cutoff is Aug 1 2025
// (07:00 UTC). Signatures after that are "current"; before it are "stale".
const NOW = new Date('2026-06-23T12:00:00.000Z');

// Born 2008 → age 2026 - 2008 = 18 → adult → requires "consent".
const ADULT_DOB = '2008-03-15';
// Born 2016 → age 2026 - 2016 = 10 → minor → requires "assent".
const MINOR_DOB = '2016-03-15';
// Born 2020 → age 6 (and grade 0 in fixtures) → too young to be prompted.
const YOUNG_DOB = '2020-03-15';

const CONSENT_AGREEMENT = {
  id: 'agreement-consent-id',
  name: 'consent-behavioral-eye-tracking',
  agreementType: 'consent',
  currentVersion: { id: 'v-consent', locale: 'en-US' },
};
const ASSENT_AGREEMENT = {
  id: 'agreement-assent-id',
  name: 'assent-behavioral-eye-tracking',
  agreementType: 'assent',
  currentVersion: { id: 'v-assent', locale: 'en-US' },
};
const TOS_AGREEMENT = {
  id: 'agreement-tos-id',
  name: 'tos',
  agreementType: 'tos',
  currentVersion: { id: 'v-tos', locale: 'en-US' },
};

const LEGAL_DOC = { text: 'Please consent.', version: 'commit-sha-123' };

/**
 * Build a userData document with a given dob/grade and optional signed records,
 * keyed exactly the way the Firestore consent flow stores them:
 * `legal[<agreement name>][<version>] = [{ dateSigned }, ...]`.
 */
const buildUserData = ({ dob, grade, signed } = {}) => ({
  id: 'student-1',
  studentData: { dob, grade },
  legal: signed ?? {},
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
    it('returns UNRESOLVED when the agreements query has not resolved', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: undefined,
        agreementsResolved: false,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.UNRESOLVED);
      // Must not even attempt to read the requirement / proceed.
      expect(getLegalDoc).not.toHaveBeenCalled();
    });

    it('returns UNRESOLVED when getLegalDoc cannot find the document (null)', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(null);

      const result = await resolveConsentRequirement({
        agreements: [CONSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.UNRESOLVED);
    });

    it('returns UNRESOLVED when getLegalDoc throws', async () => {
      const getLegalDoc = vi.fn().mockRejectedValue(new Error('GitHub fetch failed'));

      const result = await resolveConsentRequirement({
        agreements: [CONSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.UNRESOLVED);
    });
  });

  describe('(b) administration requires no matching agreement: no gate', () => {
    it('returns NOT_REQUIRED when the agreements array is empty', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: [],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.NOT_REQUIRED);
      expect(getLegalDoc).not.toHaveBeenCalled();
    });

    it('returns NOT_REQUIRED when only a non-matching agreement type is present (adult, only assent assigned)', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      // Adult requires "consent"; administration only assigns "assent" → no gate.
      const result = await resolveConsentRequirement({
        agreements: [ASSENT_AGREEMENT, TOS_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 12 }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.NOT_REQUIRED);
    });
  });

  describe('(c) consent-vs-assent choice follows age/grade', () => {
    it('selects the consent agreement for an adult (age >= 18)', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: [CONSENT_AGREEMENT, ASSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 4 }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.consentType).toBe(CONSENT_AGREEMENT.name);
      // getLegalDoc is keyed off the agreement `name`.
      expect(getLegalDoc).toHaveBeenCalledWith(CONSENT_AGREEMENT.name);
    });

    it('selects the consent agreement for a senior-grade student (grade >= 12)', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: [CONSENT_AGREEMENT, ASSENT_AGREEMENT],
        agreementsResolved: true,
        // Young dob but senior grade → still "consent".
        userData: buildUserData({ dob: MINOR_DOB, grade: 12 }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.consentType).toBe(CONSENT_AGREEMENT.name);
    });

    it('selects the assent agreement for a minor (age < 18 and grade < 12)', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: [CONSENT_AGREEMENT, ASSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({ dob: MINOR_DOB, grade: 4 }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.consentType).toBe(ASSENT_AGREEMENT.name);
      expect(getLegalDoc).toHaveBeenCalledWith(ASSENT_AGREEMENT.name);
    });
  });

  describe('(a) gate shows when a required agreement is unsigned for the current version', () => {
    it('shows the gate when there is no signed record at all', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: [ASSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({ dob: MINOR_DOB, grade: 4, signed: {} }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(true);
      expect(result.consentVersion).toBe(LEGAL_DOC.version);
      expect(result.consentText).toBe(LEGAL_DOC.text);
    });

    it('shows the gate when the only signature is stale (before the Aug-1 cutoff)', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: [ASSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({
          dob: MINOR_DOB,
          grade: 4,
          // Signed before Aug 1 2025 → stale → must re-consent.
          signed: { [ASSENT_AGREEMENT.name]: { [LEGAL_DOC.version]: [{ dateSigned: '2025-06-01T00:00:00.000Z' }] } },
        }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(true);
    });

    it('does NOT show the gate when the current version is signed after the cutoff', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: [ASSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({
          dob: MINOR_DOB,
          grade: 4,
          // Signed after Aug 1 2025 → current → no gate.
          signed: { [ASSENT_AGREEMENT.name]: { [LEGAL_DOC.version]: [{ dateSigned: '2025-09-01T00:00:00.000Z' }] } },
        }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(false);
    });

    it('does NOT show the gate for a student too young to be prompted (age <= 7 and grade <= 1), even when unsigned', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      const result = await resolveConsentRequirement({
        agreements: [ASSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({ dob: YOUNG_DOB, grade: 0, signed: {} }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(false);
    });
  });

  describe('amount/expectedTime absence must not suppress the gate (fail-safe)', () => {
    it('shows the gate for an unsigned, old-enough student with no legacy amount/expectedTime data anywhere', async () => {
      const getLegalDoc = vi.fn().mockResolvedValue(LEGAL_DOC);

      // The new agreement objects carry no amount/expectedTime fields at all.
      const result = await resolveConsentRequirement({
        agreements: [CONSENT_AGREEMENT],
        agreementsResolved: true,
        userData: buildUserData({ dob: ADULT_DOB, grade: 4, signed: {} }),
        getLegalDoc,
      });

      expect(result.status).toBe(CONSENT_REQUIREMENT_STATUS.REQUIRED);
      expect(result.shouldShow).toBe(true);
    });
  });
});
