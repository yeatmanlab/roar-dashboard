import { toValue } from 'vue';
import { getGrade } from '@bdelab/roar-utils';

/**
 * Get student's grade level
 *
 * @param {Object} studentData - Student data object
 * @returns {number} Student's grade level
 */
export const getStudentGradeLevel = (studentData) => {
  return getGrade(toValue(studentData)?.studentData?.grade);
};
