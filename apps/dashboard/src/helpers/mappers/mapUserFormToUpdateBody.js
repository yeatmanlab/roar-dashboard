/**
 * Maps the `EditUsersForm` local model (the legacy nested shape produced by
 * {@link mapUser}) into a flat, camelCased body valid against the backend's
 * `UpdateUserRequestBodySchema` for `PATCH /v1/users/:id`.
 *
 * This is the inverse of {@link mapUser} for the fields the admin edit form can
 * change. It exists so the write path stays on the same (API) source as the
 * read path — without it the form would read from Postgres but save to
 * Firestore, showing stale data after every save.
 *
 * Field handling worth calling out:
 * - `name.{first,middle,last}` → `nameFirst` / `nameMiddle` / `nameLast`.
 * - `studentData.dob` is a `Date` from `PvDatePicker`; serialized to a
 *   `YYYY-MM-DD` string from its **local** calendar components (not
 *   `toISOString()`, which would shift the day across the UTC boundary), or
 *   `null` when unset. The contract's `dob` is `z.string().date()`.
 * - `studentData.race` is an array in the form; the contract stores it as a
 *   comma-joined string (matching {@link mapUser}, which splits on `', '`).
 *   An empty selection maps to `null`.
 * - `studentData.ell_status` / `iep_status` are booleans in the form's
 *   `binaryDropdownOptions` control, but the contract types `statusEll` /
 *   `statusIep` as nullable strings — coerced via `String()` so the body
 *   validates (and round-trips through `mapUser`, which reads them as strings).
 * - `studentData.frl_status` is the enum `Free | Reduced | Paid` selected via
 *   the form's `frlOptions` control (the empty/None option maps to `null`).
 *   It is passed straight through to the contract's `statusFrl` enum, with any
 *   empty/falsy selection normalized to `null` so it clears the value rather
 *   than failing `.strict()` validation. This round-trips through {@link mapUser},
 *   which reads `statusFrl` back as the same enum value.
 * - `studentData.hispanic_ethnicity` is a boolean and maps directly to the
 *   contract's `hispanicEthnicity` boolean.
 *
 * Intentionally NOT written:
 * - `testData` / `demoData` / `tags` — retired platform-wide and excluded from
 *   `UpdateUserRequestBodySchema`; they must not be reintroduced.
 *
 * The schema requires at least one field; callers should only submit when the
 * form has data.
 *
 * @param {object|null|undefined} form – The form's local user model.
 * @returns {object} A flat body for `PATCH /v1/users/:id`.
 */
export function mapUserFormToUpdateBody(form) {
  if (!form) return {};

  const name = form.name ?? {};
  const studentData = form.studentData ?? {};

  const body = {
    nameFirst: name.first ?? null,
    nameMiddle: name.middle ?? null,
    nameLast: name.last ?? null,
    dob: serializeDob(studentData.dob),
    grade: studentData.grade ?? null,
    gender: studentData.gender ?? null,
    race: serializeRace(studentData.race),
    statusEll: coerceBooleanStatus(studentData.ell_status),
    statusFrl: normalizeFrlStatus(studentData.frl_status),
    statusIep: coerceBooleanStatus(studentData.iep_status),
    hispanicEthnicity: studentData.hispanic_ethnicity ?? null,
  };

  return body;
}

/**
 * Serializes a `PvDatePicker` value to a `YYYY-MM-DD` string from its local
 * calendar components, or `null` when unset/invalid.
 *
 * @param {Date|string|null|undefined} dob – The date value from the form.
 * @returns {string|null} The `YYYY-MM-DD` string, or `null`.
 */
function serializeDob(dob) {
  if (!dob) return null;

  const date = dob instanceof Date ? dob : new Date(dob);
  if (isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Serializes the form's race array to the contract's comma-joined string, or
 * `null` when empty. Mirrors {@link mapUser}, which splits on `', '`.
 *
 * @param {Array<string>|string|null|undefined} race – The race value from the form.
 * @returns {string|null} The comma-joined string, or `null`.
 */
function serializeRace(race) {
  if (Array.isArray(race)) {
    return race.length > 0 ? race.join(', ') : null;
  }
  return race ?? null;
}

/**
 * Coerces a boolean status flag from the form to the nullable string the
 * contract expects for `statusEll` / `statusIep`. Leaves nullish values as
 * `null` so they don't clobber an existing value with the string `"null"`.
 *
 * @param {boolean|string|null|undefined} value – The status value from the form.
 * @returns {string|null} The string representation, or `null`.
 */
function coerceBooleanStatus(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Normalizes the form's free/reduced-lunch selection to the contract's
 * `statusFrl` enum (`Free | Reduced | Paid`) or `null`. The form's `frlOptions`
 * control already holds one of those enum values, and its empty/None option
 * binds to `null`; any empty/falsy value (`null`, `undefined`, `''`) is mapped
 * to `null` so it clears the field rather than failing the strict schema.
 *
 * @param {string|null|undefined} value – The FRL value from the form.
 * @returns {string|null} The enum value, or `null`.
 */
function normalizeFrlStatus(value) {
  return value ? value : null;
}

export default mapUserFormToUpdateBody;
