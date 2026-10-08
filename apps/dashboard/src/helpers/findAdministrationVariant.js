import _isEqual from 'lodash/isEqual';

const removeNull = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null));

/**
 * Resolve an assessment saved on an administration to its task variant.
 *
 * Current administrations identify variants by ID. Parameter matching is only
 * retained for legacy administration records that do not contain a variant ID.
 *
 * @param {Object} assessment The assessment stored on the administration.
 * @param {Array<Object>} allVariants All available task variants.
 * @returns {Object|undefined} The matching task variant, if one exists.
 * @throws {Error} When the saved variant cannot be resolved uniquely.
 */
export const findAdministrationVariant = (assessment, allVariants) => {
  const variantsForTask = allVariants.filter((variant) => variant.task.id === assessment.taskId);

  if (assessment.variantId) {
    const exactMatch = variantsForTask.find((variant) => variant.id === assessment.variantId);

    if (!exactMatch) {
      throw new Error(
        `Could not find variant ${assessment.variantId} for task ${assessment.taskId}. The saved variant ID was not replaced.`,
      );
    }

    return exactMatch;
  }

  const assessmentParams = removeNull(assessment.params);
  const parameterMatches = variantsForTask.filter((variant) =>
    _isEqual(removeNull(variant.variant.params), assessmentParams),
  );

  if (parameterMatches.length > 1) {
    throw new Error(
      `Could not uniquely resolve the legacy assessment for task ${assessment.taskId}: ${parameterMatches.length} variants have the same parameters.`,
    );
  }

  if (parameterMatches.length === 0) {
    throw new Error(`Could not find a variant matching the legacy assessment for task ${assessment.taskId}.`);
  }

  return parameterMatches[0];
};
