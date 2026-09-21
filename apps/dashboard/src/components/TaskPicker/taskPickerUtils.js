import _unionBy from 'lodash/unionBy';

/**
 * The types of card the Task Picker can render.
 */
export const CARD_TYPES = Object.freeze({
  VARIANT: 'variant',
  BUNDLE: 'bundle',
});

/**
 * Merge incoming variants into the current selection, de-duplicating by variant ID.
 *
 * Every merge re-decorates the selection, replacing each entry with a new object. De-duplicating by
 * object identity therefore never matches on a subsequent merge, so the same variants get appended
 * again and the Selected Tasks list doubles. Keying the merge on `id` is what makes it idempotent.
 *
 * Entries already in the selection win over incoming duplicates, which preserves the order the user
 * arranged their cards in. Conditions are applied only as a variant enters the selection, so an
 * entry that is merely carried over keeps whatever conditions it currently has.
 *
 * @param {Array<Object>} currentVariants - The variants currently selected.
 * @param {Array<Object>} incomingVariants - The variants to merge into the selection.
 * @param {Array<Object>} preExistingAssessmentInfo - Assessments already assigned to the administration.
 * @returns {Array<Object>} The merged selection, de-duplicated by variant ID.
 */
export const mergeSelectedVariants = (currentVariants, incomingVariants, preExistingAssessmentInfo = []) => {
  // Re-applying conditions to entries that are already selected would overwrite edits made through
  // updateVariant, which would leave this helper's correctness depending on the parent never
  // re-supplying inputVariants.
  const alreadySelectedIds = new Set(currentVariants.map((variant) => variant?.id));

  return _unionBy(currentVariants, incomingVariants, 'id').map((variant) => {
    const decorated = { ...variant, type: CARD_TYPES.VARIANT };

    if (alreadySelectedIds.has(decorated?.id)) {
      return decorated;
    }

    const preExistingInfo = preExistingAssessmentInfo.find((info) => info?.variantId === decorated?.id);

    if (preExistingInfo) {
      return {
        ...decorated,
        variant: { ...decorated?.variant, conditions: preExistingInfo.conditions },
      };
    }

    return decorated;
  });
};
