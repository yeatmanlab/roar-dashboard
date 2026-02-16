import type { Grade } from '../enums/grade.enum';

/**
 * Majority age threshold (18 years old in most US jurisdictions).
 */
const MAJORITY_AGE = 18;

/**
 * Grade to typical age mapping.
 * Based on US education system where students typically start kindergarten at age 5-6.
 *
 * We use the LOWER end of the typical age range to be conservative for consent purposes:
 * when uncertain, assume the user is younger (a minor) to err on the side of requiring
 * parental consent rather than incorrectly treating a minor as an adult.
 */
const GRADE_TO_AGE: Record<string, number> = {
  InfantToddler: 1,
  Preschool: 3,
  PreKindergarten: 4,
  TransitionalKindergarten: 4,
  Kindergarten: 5,
  '1': 6,
  '2': 7,
  '3': 8,
  '4': 9,
  '5': 10,
  '6': 11,
  '7': 12,
  '8': 13,
  '9': 14,
  '10': 15,
  '11': 16,
  '12': 17,
  '13': 18,
  PostGraduate: 18,
};

/**
 * Calculate a user's age from their date of birth.
 *
 * Uses UTC methods consistently to avoid timezone-related off-by-one errors.
 * Date-only strings like 'YYYY-MM-DD' are parsed as UTC midnight by JavaScript,
 * so we must use getUTC* methods to get the correct date components.
 *
 * @param dob - Date of birth (Date object or ISO date string)
 * @returns Age in years
 */
function calculateAgeFromDob(dob: Date | string): number {
  const dobDate = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();

  // Use UTC methods to avoid timezone shifts when parsing date-only strings
  let age = today.getUTCFullYear() - dobDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dobDate.getUTCMonth();

  // Adjust if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dobDate.getUTCDate())) {
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
