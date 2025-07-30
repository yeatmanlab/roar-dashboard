import { toValue } from 'vue';

/**
 * Gets the display name for a student
 *
 * @TODO: Validate the expected business logic regarding username fallback combined with lastname.
 *
 * @param {Object} studentData - Student data object.
 * @returns {Object<{firstName: string, lastName: string}>} Object containing firstName and lastName.
 */
export const getStudentDisplayName = (studentData) => {
  if (!toValue(studentData)) {
    return { firstName: '', lastName: '' };
  }

  const firstName = toValue(studentData)?.name?.first || toValue(studentData)?.username || '';
  const lastName = toValue(studentData)?.name?.last || '';

  return { firstName, lastName };
};
