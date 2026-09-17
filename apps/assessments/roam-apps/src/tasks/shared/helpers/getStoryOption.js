import { getGrade } from '@bdelab/roar-utils';

/**
 * Determines whether to show the "story" version of a task.
 *
 * Rules: When opt is:
 *   - boolean            → returned as-is
 *   - 'grade-based'      → true if grade is null/undefined or grade < 6, false otherwise
 *   - 'true' / 'false'   → parsed as booleans (case-insensitive)
 *   - anything else      → defaults to true
 *     (empty string, unrecognized string, null, undefined)
 */
export const getStoryOption = (opt, grade) => {
  if (typeof opt === 'boolean') {
    return opt;
  }

  if (typeof opt === 'string') {
    const normalized = opt.toLowerCase();

    if (normalized === 'grade-based') {
      if (grade == null) {
        return true;
      }
      return getGrade(grade) < 6;
    }
    if (normalized === 'false') {
      return false;
    }
    if (normalized === 'true') {
      return true;
    }
  }

  // null, undefined, empty string, or any unrecognized string
  return true;
};
