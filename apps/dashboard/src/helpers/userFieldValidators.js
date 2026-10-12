/**
 * Validators for user-record fields supplied via CSV upload or registration forms.
 *
 * These are plain predicates (not Vuelidate validators — see formValidators.js for those)
 * so they can be reused by any entry point that accepts user records.
 */

/**
 * Validate an email address.
 *
 * Email validation rules:
 * Local part (before @):
 *   - Allows: letters, numbers, +, _, -, ', .
 *   - Must start/end with: letter, number, +, _, -, or '
 *   - No consecutive periods
 *   - Can have consecutive +, _, -, '
 * Domain part (after @):
 *   - Requires at least one period
 *   - No consecutive periods
 *   - No leading/trailing periods or hyphens
 *   - TLD (last part) cannot contain hyphens
 *   - Allows consecutive hyphens in middle parts
 *
 * @param {String} email - The email address to validate.
 * @returns {Boolean} True if the email is properly formatted.
 */
export const isEmailValid = (email) => {
  if (!email) return false;
  // Keep `-+`, not `-*`: an optional hyphen causes exponential backtracking.
  const emailRegex =
    /^[a-zA-Z0-9+_'-]+(\.[a-zA-Z0-9+_'-]+)*@[a-zA-Z0-9]+(-+[a-zA-Z0-9]+)*(\.[a-zA-Z0-9]+(-+[a-zA-Z0-9]+)*)*\.[a-zA-Z0-9]+$/;
  return emailRegex.test(email);
};

/**
 * Validate a username.
 *
 * Username validation rules:
 *   - Allows: letters, numbers, and ', _, -, . as separators
 *   - Must start and end with a letter or number
 *   - No consecutive separators
 *
 * Stricter than the email local part on purpose. Must stay a subset of it, since
 * usernames become emails via `${username}@roar-auth.com`.
 *
 * @param {String} username - The username to validate.
 * @returns {Boolean} True if the username is properly formatted.
 */
export const isUsernameValid = (username) => {
  if (!username) return false;
  // Keep the separator required, not `['_.-]?` — optional causes exponential backtracking.
  const usernameRegex = /^[a-zA-Z0-9]+(['_.-][a-zA-Z0-9]+)*$/;
  return usernameRegex.test(username);
};

/**
 * Validate a password.
 *
 * @param {String} password - The password to validate.
 * @returns {Boolean} True if at least 6 characters long and containing at least one letter.
 */
export const isPasswordValid = (password) => {
  if (!password) return false;
  return password.length >= 6 && /[a-zA-Z]/.test(password);
};
