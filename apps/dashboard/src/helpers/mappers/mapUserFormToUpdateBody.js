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
 * - `studentData.hispanic_ethnicity` is a boolean and maps directly to the
 *   contract's `hispanicEthnicity` boolean.
 *
 * Intentionally NOT written:
 * - `studentData.frl_status` — the form control is a boolean, but the contract
 *   types `statusFrl` as the enum `Free | Reduced | Paid`. There is no lossless
 *   boolean → enum coercion, and `UpdateUserRequestBodySchema` is `.strict()`,
 *   so sending the boolean would reject the **entire** request. Faithfully
 *   editing FRL needs a control rework, which is out of scope for this
 *   transport migration. The field is omitted rather than risk breaking saves.
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

export default mapUserFormToUpdateBody;
