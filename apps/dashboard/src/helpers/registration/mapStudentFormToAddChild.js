import { mapGradeToApi } from './mapGradeToApi';
import { formatDobToApiDate } from './formatDobToApiDate';

/**
 * Maps a single ROAR@Home child registration-form entry to the request shape
 * expected by `POST /v1/families/:familyId/users` (`AddChildSchema`).
 *
 * The form (`components/auth/RegisterChildren.vue`) produces a flat student
 * object; the API expects a nested, `.strict()` shape with a required
 * `name.{first,last}`, a `YYYY-MM-DD` `dob`, a long-form `grade` enum value,
 * and an optional `demographics` object whose keys differ from the form's.
 *
 * Because the body schema is `.strict()`, this mapper emits *only* the keys the
 * contract accepts — any extra field (e.g. the form's `confirmPassword`,
 * `accept`, `orgName`) would be rejected. Optional/empty demographic fields are
 * omitted rather than sent as empty strings so the corresponding columns stay
 * null.
 *
 * @param {Object} student - A student entry from the registration form.
 * @returns {Object} The mapped `AddChildSchema`-shaped object.
 * @throws {Error} If a required field (name, password, dob, grade, activation
 *   code) is missing or invalid.
 */

const ROAR_AUTH_EMAIL_DOMAIN = '@roar-auth.com';

/**
 * Maps the form's yes/no string (`'Y'`/`'N'`) to a status string the API stores
 * verbatim, or `undefined` when unspecified so the field is omitted.
 *
 * @param {string|undefined|null} value - The form value.
 * @returns {string|undefined} `'Y'`/`'N'` passed through, or `undefined`.
 */
function mapYesNoStatus(value) {
  if (value === 'Y' || value === 'N') return value;
  return undefined;
}

/**
 * Maps the form's yes/no string (`'Y'`/`'N'`) to the API's boolean
 * `hispanicEthnicity`, or `undefined` when unspecified.
 *
 * @param {string|undefined|null} value - The form value.
 * @returns {boolean|undefined} `true` for `'Y'`, `false` for `'N'`, else `undefined`.
 */
function mapHispanicEthnicity(value) {
  if (value === 'Y') return true;
  if (value === 'N') return false;
  return undefined;
}

/**
 * Serializes a multi-select list (the form's `race` / `homeLanguage` arrays) to
 * the single comma-separated string the API stores, or `undefined` when empty.
 *
 * @param {Array<string>|string|undefined|null} value - The form value.
 * @returns {string|undefined} Comma-separated values, or `undefined`.
 */
function mapList(value) {
  if (Array.isArray(value)) {
    const cleaned = value.map((entry) => String(entry).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(', ') : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}

/**
 * Maps a free/reduced lunch form value to the API's `statusFrl` enum
 * (`Free`/`Reduced`/`Paid`), omitting any other/empty value (e.g. legacy
 * `'N/A'`) which the enum does not accept.
 *
 * @param {string|undefined|null} value - The form value.
 * @returns {string|undefined} A valid `statusFrl` value, or `undefined`.
 */
function mapFreeReducedLunch(value) {
  if (value === 'Free' || value === 'Reduced' || value === 'Paid') return value;
  return undefined;
}

/**
 * Builds the optional `demographics` object, including only fields that have a
 * meaningful value. Returns `undefined` when nothing maps so the key is omitted.
 *
 * @param {Object} student - The form student entry.
 * @returns {Object|undefined} The demographics object, or `undefined`.
 */
function mapDemographics(student) {
  const demographics = {};

  const gender = typeof student.gender === 'string' && student.gender.trim() !== '' ? student.gender.trim() : undefined;
  if (gender !== undefined) demographics.gender = gender;

  const race = mapList(student.race);
  if (race !== undefined) demographics.race = race;

  const statusEll = mapYesNoStatus(student.ell);
  if (statusEll !== undefined) demographics.statusEll = statusEll;

  const statusFrl = mapFreeReducedLunch(student.freeReducedLunch);
  if (statusFrl !== undefined) demographics.statusFrl = statusFrl;

  const statusIep = mapYesNoStatus(student.IEPStatus);
  if (statusIep !== undefined) demographics.statusIep = statusIep;

  const hispanicEthnicity = mapHispanicEthnicity(student.hispanicEthnicity);
  if (hispanicEthnicity !== undefined) demographics.hispanicEthnicity = hispanicEthnicity;

  const homeLanguage = mapList(student.homeLanguage);
  if (homeLanguage !== undefined) demographics.homeLanguage = homeLanguage;

  return Object.keys(demographics).length > 0 ? demographics : undefined;
}

/**
 * Normalizes the form username into an email. The child form emits
 * `studentUsername` already suffixed with `@roar-auth.com`, but we re-apply the
 * suffix defensively so this mapper is the single source of truth for the rule.
 *
 * @param {string} studentUsername - The form username (with or without domain).
 * @returns {string} The student email.
 */
function toStudentEmail(studentUsername) {
  if (typeof studentUsername !== 'string' || studentUsername.trim() === '') {
    throw new Error('Student username is required.');
  }
  const trimmed = studentUsername.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed}${ROAR_AUTH_EMAIL_DOMAIN}`;
}

export function mapStudentFormToAddChild(student) {
  if (!student || typeof student !== 'object') {
    throw new Error('A student entry is required.');
  }

  const email = toStudentEmail(student.studentUsername);

  if (typeof student.password !== 'string' || student.password === '') {
    throw new Error('Student password is required.');
  }

  // The API requires a non-empty first and last name matching its identifier
  // regex; the form leaves these optional. Fail clearly here rather than sending
  // a body the backend would reject with a 400.
  const first = typeof student.firstName === 'string' ? student.firstName.trim() : '';
  const last = typeof student.lastName === 'string' ? student.lastName.trim() : '';
  if (first === '' || last === '') {
    throw new Error('Student first and last name are required.');
  }

  const middle =
    typeof student.middleName === 'string' && student.middleName.trim() !== '' ? student.middleName.trim() : undefined;

  if (typeof student.activationCode !== 'string' || student.activationCode.trim() === '') {
    throw new Error('Student activation code is required.');
  }

  const name = { first, last };
  if (middle !== undefined) name.middle = middle;

  const demographics = mapDemographics(student);

  const child = {
    email,
    password: student.password,
    name,
    dob: formatDobToApiDate(student.dob),
    grade: mapGradeToApi(student.grade),
    activationCode: student.activationCode.trim(),
  };

  if (demographics !== undefined) child.demographics = demographics;

  return child;
}

export default mapStudentFormToAddChild;
