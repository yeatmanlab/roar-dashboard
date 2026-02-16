/**
 * Grade values mapped to numeric values for comparison.
 * Keys are exact matches for the gradeEnum values from db/schema/enums.ts.
 *
 * Numeric mapping matches the reference implementation:
 * - All early childhood grades (infant through kindergarten) map to 0
 * - Grades 1-12 map to their numeric values
 * - Post-secondary grades map to 13
 *
 * Values that return null (not in map and fail numeric parsing):
 * - Empty string ('') - represents unspecified grade
 * - 'Ungraded' - explicitly ungraded students
 * - 'Other' - non-standard grade levels
 */
const GRADE_MAP: Record<string, number> = {
  InfantToddler: 0,
  Preschool: 0,
  PreKindergarten: 0,
  TransitionalKindergarten: 0,
  Kindergarten: 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  '11': 11,
  '12': 12,
  '13': 13,
  PostGraduate: 13,
};

/**
 * Convert a grade to a numeric value for comparison.
 * Accepts exact gradeEnum values from the database or numeric values.
 *
 * @param grade - Grade enum value (e.g., "Kindergarten", "5") or number
 * @returns Numeric grade value, or null for special/invalid values:
 *   - null input returns null
 *   - Empty string ('') returns null (unspecified grade)
 *   - 'Ungraded', 'Other' return null (non-numeric grades)
 *   - Invalid/unknown strings return null
 */
export function getGradeAsNumber(grade: string | number | null): number | null {
  if (grade === null) return null;

  // If already a number, just validate and return
  if (typeof grade === 'number') {
    return isNaN(grade) ? null : grade;
  }

  // Empty string is a valid enum value meaning unspecified, return null
  if (grade === '') return null;

  // Direct lookup using exact enum value
  const mapped = GRADE_MAP[grade];
  if (mapped !== undefined) {
    return mapped;
  }

  // Try parsing as number
  const parsed = parseInt(grade, 10);
  return isNaN(parsed) ? null : parsed;
}
