/**
 * Maps a user record from the backend API (`GET /v1/users/:id`, `UserResponseSchema`)
 * into the legacy nested shape the dashboard's user-data consumers expect.
 *
 * The backend returns demographic and identifier fields flat and camelCased
 * (`statusEll`, `sisId`, `nameFirst`); the dashboard historically read them nested
 * under `studentData` with snake_cased keys (`ell_status`, `sis_id`) and the name
 * nested under `name`. This mapper bridges the two so the read migration requires no
 * changes in the consuming components.
 *
 * The retired `tags`, `testData`, and `demoData` fields are intentionally not mapped —
 * they are being removed from the platform and must not be reintroduced.
 *
 * @NOTE `student_number` is mapped from the API `studentId`. Confirm this pairing against
 *   the rostering source if district student-number display looks wrong — `localId` is the
 *   other candidate and has no current consumer.
 *
 * @param {object|null|undefined} user – The API user record, or a nullish value when absent.
 * @returns {object|null} The legacy-shaped user object, or `null` when `user` is nullish.
 */
export function mapUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    userType: user.userType,
    assessmentPid: user.assessmentPid,
    name: {
      first: user.nameFirst,
      middle: user.nameMiddle,
      last: user.nameLast,
    },
    studentData: {
      dob: user.dob,
      grade: user.grade,
      schoolLevel: user.schoolLevel,
      gender: user.gender,
      // Demographic flags: API camelCase → legacy snake_case keys read by the components.
      ell_status: user.statusEll,
      frl_status: user.statusFrl,
      iep_status: user.statusIep,
      hispanic_ethnicity: user.hispanicEthnicity,
      // The API returns race as a comma-joined string; consumers render it as an array via
      // `.join(', ')`. Split back to an array, or null when absent so the `?? 'None'`
      // display fallback still fires (an empty array would render as an empty string).
      race: user.race ? user.race.split(', ') : null,
      // Identifier fields: API camelCase → legacy snake_case keys.
      sis_id: user.sisId,
      state_id: user.stateId,
      student_number: user.studentId,
    },
    // Present only when the caller is a super admin (the API omits it otherwise).
    isSuperAdmin: user.isSuperAdmin,
  };
}

export default mapUser;
