/**
 * Maps a ROAR@Home registration-form grade value to the backend `UserGradeSchema`
 * enum value used by `POST /v1/families/:familyId/users`.
 *
 * The child registration form (`components/auth/RegisterChildren.vue`) emits the
 * short legacy codes `'PK'`, `'TK'`, `'K'` and the numeric strings `'1'`–`'12'`.
 * The typed API enum (`packages/api-contract` `UserGradeSchema`, mirroring the
 * backend `gradeEnum`) instead uses the long-form values `'PreKindergarten'`,
 * `'TransitionalKindergarten'`, `'Kindergarten'` and the numeric strings
 * `'1'`–`'13'`. This helper bridges the two.
 *
 * Unknown values throw rather than silently passing through — sending an
 * unmapped grade would either be rejected by the contract (`.strict()` enum)
 * or, worse, coerced to an empty/wrong value. Failing loudly surfaces the
 * mismatch at the point of submission.
 *
 * @param {string} grade - The form grade value (e.g. `'PK'`, `'K'`, `'3'`).
 * @returns {string} The corresponding `UserGradeSchema` enum value.
 * @throws {Error} If the grade is missing or not a recognized form value.
 */

// Long-form enum values must stay in sync with the backend `gradeEnum`
// (apps/backend/src/db/schema/enums.ts) and the api-contract `UserGradeSchema`.
const SHORT_CODE_TO_API_GRADE = Object.freeze({
  PK: 'PreKindergarten',
  TK: 'TransitionalKindergarten',
  K: 'Kindergarten',
});

// Numeric grades the form can emit; these pass through unchanged because the
// API enum accepts the same numeric-string values.
const PASS_THROUGH_NUMERIC_GRADES = Object.freeze(
  new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']),
);

export function mapGradeToApi(grade) {
  if (grade === undefined || grade === null || grade === '') {
    throw new Error('Grade is required and cannot be empty.');
  }

  const value = String(grade);

  if (Object.prototype.hasOwnProperty.call(SHORT_CODE_TO_API_GRADE, value)) {
    return SHORT_CODE_TO_API_GRADE[value];
  }

  if (PASS_THROUGH_NUMERIC_GRADES.has(value)) {
    return value;
  }

  throw new Error(`Unrecognized grade value: "${grade}".`);
}

export default mapGradeToApi;
