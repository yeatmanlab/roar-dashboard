import type { Grade } from '../enums/grade.enum';

/**
 * Majority age threshold (18 years old in most US jurisdictions).
 */
const MAJORITY_AGE = 18;

/**
 * Grade to typical age mapping.
 * Based on US education system where students typically start kindergarten at age 5-6.
 * We use the higher end of the typical age range to be conservative
 * (i.e., assume younger age when uncertain).
 */
const GRADE_TO_AGE: Record<string, number> = {
  InfantToddler: 2,
  Preschool: 4,
  PreKindergarten: 5,
  TransitionalKindergarten: 5,
  Kindergarten: 6,
  '1': 7,
  '2': 8,
  '3': 9,
  '4': 10,
  '5': 11,
  '6': 12,
  '7': 13,
  '8': 14,
  '9': 15,
  '10': 16,
  '11': 17,
  '12': 18,
  '13': 19,
  PostGraduate: 19,
};

/**
 * Calculate a user's age from their date of birth.
 *
 * @param dob - Date of birth (Date object or ISO date string)
 * @returns Age in years
 */
function calculateAgeFromDob(dob: Date | string): number {
  const dobDate = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const monthDiff = today.getMonth() - dobDate.getMonth();

  // Adjust if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Estimate a user's age from their grade level.
 * Returns null if the grade doesn't have a known age mapping.
 *
 * @param grade - Grade level
 * @returns Estimated age in years, or null if unknown
 */
function estimateAgeFromGrade(grade: Grade | null): number | null {
  if (!grade) return null;
  return GRADE_TO_AGE[grade] ?? null;
}

/**
 * Determine if a user is of majority age (18+).
 *
 * Age determination priority:
 * 1. If `dob` is provided, calculate exact age
 * 2. If `dob` is missing, estimate from `grade`
 * 3. If neither is available, return null (unknown)
 *
 * @param user - User object with optional dob and grade fields
 * @returns true if 18+, false if under 18, null if age cannot be determined
 */
export function isMajorityAge(user: { dob: Date | string | null; grade: Grade | null }): boolean | null {
  // Priority 1: Calculate from date of birth
  if (user.dob) {
    const age = calculateAgeFromDob(user.dob);
    return age >= MAJORITY_AGE;
  }

  // Priority 2: Estimate from grade
  const estimatedAge = estimateAgeFromGrade(user.grade);
  if (estimatedAge !== null) {
    return estimatedAge >= MAJORITY_AGE;
  }

  // Cannot determine age
  return null;
}
