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
 * Every merge re-decorates the selection (card type, plus conditions for variants already assigned
 * to the administration), which replaces each entry with a new object. De-duplicating by object
 * identity therefore never matches on a subsequent merge, so the same variants get appended again
 * and the Selected Tasks list doubles. Keying the merge on `id` is what makes it idempotent.
 *
 * Entries already in the selection win over incoming duplicates, which preserves the order the user
 * arranged their cards in.
 *
 * @param {Array<Object>} currentVariants - The variants currently selected.
 * @param {Array<Object>} incomingVariants - The variants to merge into the selection.
 * @param {Array<Object>} preExistingAssessmentInfo - Assessments already assigned to the administration.
 * @returns {Array<Object>} The merged selection, de-duplicated by variant ID.
 */
export const mergeSelectedVariants = (currentVariants, incomingVariants, preExistingAssessmentInfo = []) => {
  const merged = _unionBy(currentVariants, incomingVariants, 'id');

  return merged.map((variant) => {
    const decorated = { ...variant, type: CARD_TYPES.VARIANT };
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
