/**
 * Maps an enrolled-user list row from the backend API
 * (`GET /v1/{districts|schools|classes|groups}/:id/users?embed=demographics`)
 * into the flat object the org-users CSV export serialises — one property per
 * CSV column, in the exact header order the export has always produced.
 *
 * Column parity is the whole point of this mapper. The pre-migration export read
 * the same rows from Firestore and emitted these 14 columns in this order:
 *
 *   Username, Email, FirstName, LastName, Grade, Gender, DateOfBirth, UserType,
 *   ell_status, iep_status, frl_status, race, hispanic_ethnicity, home_language
 *
 * Downstream consumers parse that header set positionally/by name, so the names,
 * order, and cell formatting must not change.
 *
 * Field sources:
 * - Identity + base demographics come from the lean `EnrolledUserSchema`
 *   (`username`, `email`, `nameFirst`, `nameLast`, `grade`, `gender`, `dob`).
 * - PII demographics come from the `demographics` sub-object, present only when
 *   the request includes `?embed=demographics` (`EnrolledUserDemographicsSchema`:
 *   `userType`, `statusEll`, `statusIep`, `statusFrl`, `race`, `hispanicEthnicity`,
 *   `homeLanguage`).
 *
 * Formatting notes (preserved from the Firestore export so cells are byte-stable):
 * - `race` is taken as the API's raw value — a comma-joined string such as
 *   `"White, Asian"`. It is deliberately NOT split into an array (the array split
 *   in `mapUser` is a display-only transform for the profile view); a scalar
 *   string is what the old export wrote into the cell and what serialises cleanly.
 * - `hispanic_ethnicity` is the raw boolean (`true`/`false`/`null`). The shared
 *   CSV serialiser (`flattenObj` + Papa) renders a truthy boolean as `true` and a
 *   falsy/absent value as an empty cell — identical to the Firestore boolean.
 * - Absent values pass through as `undefined`/`null`; the serialiser turns them
 *   into empty cells, matching the previous behaviour for unrostered fields.
 *
 * The retired `tags`, `testData`, and `demoData` fields are intentionally not
 * read — they are being removed from the platform and must not be reintroduced.
 *
 * @param {object} user – The API enrolled-user record (expects `?embed=demographics`).
 * @returns {object} A flat object keyed by CSV column header, in column order.
 */
export function mapEnrolledUserForExport(user) {
  // `demographics` is only present when the embed was requested; default to an
  // empty object so a misconfigured caller yields empty PII cells rather than
  // throwing mid-export.
  const demographics = user?.demographics ?? {};

  return {
    Username: user?.username,
    Email: user?.email,
    FirstName: user?.nameFirst,
    LastName: user?.nameLast,
    Grade: user?.grade,
    Gender: user?.gender,
    DateOfBirth: user?.dob,
    UserType: demographics.userType,
    ell_status: demographics.statusEll,
    iep_status: demographics.statusIep,
    frl_status: demographics.statusFrl,
    race: demographics.race,
    hispanic_ethnicity: demographics.hispanicEthnicity,
    home_language: demographics.homeLanguage,
  };
}

export default mapEnrolledUserForExport;
