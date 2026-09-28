/**
 * Maps the ROAR@Home parent/guardian registration-form values to the request
 * body expected by `POST /v1/families/` (`CreateFamilyRequestSchema`).
 *
 * The create-family endpoint registers the caretaker and their family in one
 * call. The legacy `canContactForFutureStudies` checkbox maps to the nested
 * `optIns.researchContact` preference expected by the strict API contract.
 * Legacy `invitationCodes` are intentionally not part of this caretaker call.
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
 * @param {boolean} form.canContactForFutureStudies - Research-contact preference.
 * @returns {{ email: string, password: string, name: { first: string, last: string }, optIns: { researchContact: boolean } }}
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

  if (typeof form.canContactForFutureStudies !== 'boolean') {
    throw new Error('Research contact preference must be a boolean.');
  }

  return {
    email,
    password: form.password,
    name: { first, last },
    optIns: { researchContact: form.canContactForFutureStudies },
  };
}

export default mapParentFormToCreateFamily;
