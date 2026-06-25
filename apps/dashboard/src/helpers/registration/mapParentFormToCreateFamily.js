/**
 * Maps the ROAR@Home parent/guardian registration-form values to the request
 * body expected by `POST /v1/families/` (`CreateFamilyRequestSchema`).
 *
 * The create-family endpoint registers the caretaker and their family in one
 * call. Its body is `.strict()` and accepts only `{ email, password, name, location? }`
 * — notably it does NOT accept the legacy `canContactForFutureStudies` flag or
 * `invitationCodes` that the old firekit `createNewFamily` payload carried, so
 * those are intentionally dropped here. (See the migration report for the
 * follow-up needed to preserve `canContactForFutureStudies`.)
 *
 * `name.{first,last}` are required and must match the API's identifier regex
 * (start with a letter); this mapper trims them and fails clearly if either is
 * empty.
 *
 * @param {Object} form - The parent registration form values.
 * @param {string} form.email - The caretaker email.
 * @param {string} form.password - The caretaker password.
 * @param {string} form.firstName - The caretaker first name.
 * @param {string} form.lastName - The caretaker last name.
 * @returns {{ email: string, password: string, name: { first: string, last: string } }}
 *   The `CreateFamilyRequestSchema`-shaped body.
 * @throws {Error} If a required field is missing.
 */
export function mapParentFormToCreateFamily(form) {
  if (!form || typeof form !== 'object') {
    throw new Error('Parent registration details are required.');
  }

  const email = typeof form.email === 'string' ? form.email.trim() : '';
  if (email === '') {
    throw new Error('Parent email is required.');
  }

  if (typeof form.password !== 'string' || form.password === '') {
    throw new Error('Parent password is required.');
  }

  const first = typeof form.firstName === 'string' ? form.firstName.trim() : '';
  const last = typeof form.lastName === 'string' ? form.lastName.trim() : '';
  if (first === '' || last === '') {
    throw new Error('Parent first and last name are required.');
  }

  // NOTE: `form.canContactForFutureStudies` is intentionally omitted. The
  // `POST /v1/families/` body (`CreateFamilyRequestSchema`) is `.strict()` and
  // does not yet accept this flag, so including it would make the create request
  // fail. Preserving it (form schema + backend support) is tracked for a
  // follow-up; left here so the dropped field isn't silently forgotten.
  return {
    email,
    password: form.password,
    name: { first, last },
  };
}

export default mapParentFormToCreateFamily;
