import { toValue } from 'vue';
import { getGrade } from '@bdelab/roar-utils';

/**
 * Get student's grade level (normalized numeric)
 *
 * Accepts either:
 * - a full studentData object with nested studentData.grade
 * - a raw grade value (number|string)
 *
 * @param {Object|number|string} input - Student data or raw grade value
 * @returns {number} Student's grade level
 */
export const getStudentGradeLevel = (input) => {
  const value = toValue(input);

  // If the caller passed a numeric grade, use it directly
  if (typeof value === 'number') return value;

  // If the caller passed a raw grade string (e.g., '3', 'K', '2nd'), normalize it
  if (typeof value === 'string') return getGrade(value);

  // Otherwise assume a studentData-like object with nested grade
  return getGrade(value?.studentData?.grade);
};
