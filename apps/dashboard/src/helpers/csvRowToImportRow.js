/**
 * Maps a CSV-mapped student row (keyed by RegisterStudents' canonical field names: `username`,
 * `email`, `password`, `dob`, `grade`, `first`/`middle`/`last`, the demographic fields, `stateId`,
 * `pid`, `unenroll`, …) directly into an `ImportUserRow` for `POST /v1/users/import`.
 *
 * This produces the contract shape in one step — no intermediate Firekit payload. The caller
 * (`transformStudentData`) resolves organizations into `memberships` separately, since that requires
 * async org-id lookups. Demographic keys are renamed to the contract's (`ellStatus` → `statusEll`,
 * etc.); the retired `testData` field is intentionally dropped.
 */

const TRUTHY = new Set(['true', 'yes', '1', 't', 'y']);

/** Coerce a CSV cell (string/boolean) into a boolean; empty/absent is false. */
export function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  return TRUTHY.has(String(value).trim().toLowerCase());
}

function isPresent(value) {
  return value != null && value !== '';
}

/**
 * @param {Record<string, unknown>} row - A CSV-mapped student row (canonical keys).
 * @returns {object} An `ImportUserRow` with `memberships: []` (the caller fills memberships in).
 */
export function csvRowToImportRow(row) {
  const importRow = { userType: 'student', name: {}, memberships: [] };

  // A username maps to a synthetic email; an explicit email (if mapped) wins.
  if (isPresent(row.username)) importRow.email = `${row.username}@roar-auth.com`;
  if (isPresent(row.email)) importRow.email = row.email;

  if (isPresent(row.password)) importRow.password = row.password;
  if (isPresent(row.dob)) importRow.dob = row.dob;
  if (isPresent(row.grade)) importRow.grade = row.grade;

  if (isPresent(row.first)) importRow.name.first = row.first;
  if (isPresent(row.middle)) importRow.name.middle = row.middle;
  if (isPresent(row.last)) importRow.name.last = row.last;

  const demographics = {};
  if (isPresent(row.gender)) demographics.gender = row.gender;
  if (isPresent(row.race)) demographics.race = row.race;
  if (isPresent(row.ellStatus)) demographics.statusEll = row.ellStatus;
  if (isPresent(row.frlStatus)) demographics.statusFrl = row.frlStatus;
  if (isPresent(row.iepStatus)) demographics.statusIep = row.iepStatus;
  if (isPresent(row.hispanicEthnicity)) demographics.hispanicEthnicity = toBoolean(row.hispanicEthnicity);
  if (isPresent(row.homeLanguage)) demographics.homeLanguage = row.homeLanguage;
  if (Object.keys(demographics).length > 0) importRow.demographics = demographics;

  const identifiers = {};
  if (isPresent(row.stateId)) identifiers.stateId = row.stateId;
  if (isPresent(row.pid)) identifiers.pid = row.pid;
  if (Object.keys(identifiers).length > 0) importRow.identifiers = identifiers;

  if (toBoolean(row.unenroll)) importRow.unenroll = true;

  return importRow;
}

export default csvRowToImportRow;
