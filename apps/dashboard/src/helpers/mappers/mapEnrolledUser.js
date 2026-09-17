/**
 * Maps an enrolled-user list row from the backend API
 * (`GET /v1/{districts|schools|classes|groups}/:id/users`, `EnrolledUserSchema`)
 * into the legacy nested shape the org user-list table reads.
 *
 * `EnrolledUserSchema` is `UserSchema` + `roles: UserRole[]`. It is the lean
 * list-row projection: it carries identity, demographic, and identifier fields
 * flat and camelCased (`nameFirst`, `stateId`, `grade`), plus the user's roles
 * on the org being listed. Unlike the full `GET /v1/users/:id` profile it does
 * NOT include `userType`, `archived`, demographic flags (`statusEll`,
 * `statusFrl`, …), `assessmentPid`, or `isSuperAdmin` — so those are not mapped
 * here. Use {@link mapUser} for the full single-user profile.
 *
 * This is intentionally a separate mapper from `mapUser`: forcing the list row
 * through `mapUser` would silently produce `undefined`/`null` for the many
 * profile-only fields it reads and would drop `roles` (which `mapUser` does not
 * carry). A focused mapper keeps the list-row contract explicit.
 *
 * The retired `tags`, `testData`, and `demoData` fields are intentionally not
 * mapped — they are being removed from the platform and must not be reintroduced.
 *
 * @NOTE `student_number` is mapped from the API `studentId`, mirroring
 *   {@link mapUser}. `localId` has no current consumer.
 *
 * @param {object|null|undefined} user – The API enrolled-user record, or a
 *   nullish value when absent.
 * @returns {object|null} The legacy-shaped user row, or `null` when `user` is nullish.
 */
export function mapEnrolledUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    // The roles the user holds on the org being listed (e.g. ['student']).
    roles: user.roles ?? [],
    name: {
      first: user.nameFirst,
      last: user.nameLast,
    },
    studentData: {
      dob: user.dob,
      grade: user.grade,
      gender: user.gender,
      // Identifier field: API camelCase → legacy snake_case key read by the column.
      state_id: user.stateId,
      sis_id: user.sisId,
      student_number: user.studentId,
    },
  };
}

export default mapEnrolledUser;
