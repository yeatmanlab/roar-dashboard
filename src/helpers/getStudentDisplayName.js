/**
 * Gets the display name for a student
 *
 * @param {Object} studentData - Student data object.
 * @returns {Object<{firstName: string, lastName: string}>} Object containing firstName and lastName.
 */
export const getStudentDisplayName = (studentData) => {
  if (!studentData) {
    return { firstName: '', lastName: '' };
  }

  const firstName = studentData?.name?.first || studentData?.username || '';
  const lastName = studentData?.name?.last || '';

  return { firstName, lastName };
};
